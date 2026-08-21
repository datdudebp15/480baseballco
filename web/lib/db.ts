// Dual-driver data layer.
//   - No DATABASE_URL  -> better-sqlite3 file at data/app.db (local dev)
//   - DATABASE_URL set -> Postgres (Neon in production)
// All SQL is written with `?` placeholders and ISO-8601 UTC timestamp params
// so the same queries run on both engines. Timestamps used in logic are
// always passed in as params (never datetime('now') / now()) for parity.
import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { localKey, addDays } from "./schedule";
import { phoenixNow } from "./time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Dbx {
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<number>; // affected rows
  tx<T>(fn: (t: Dbx) => Promise<T>): Promise<T>;
  // Serializes concurrent writes to one slot. No-op on SQLite (single
  // writer); Postgres takes a transaction-scoped advisory lock. Call inside tx.
  lockSlot(date: string, hour: number): Promise<void>;
}

export function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

// Vercel's storage integrations inject the connection string under varying
// names depending on how the database was linked — accept the common ones.
export function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_POSTGRES_URL ??
    process.env.NEON_DATABASE_URL ??
    process.env.STORAGE_URL
  );
}

/* ---------------- SQLite driver ---------------- */

class SqliteDbx implements Dbx {
  constructor(private db: Database.Database) {}

  async get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  async all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
  async run(sql: string, params: unknown[] = []): Promise<number> {
    return this.db.prepare(sql).run(...params).changes;
  }
  async lockSlot(): Promise<void> {
    /* single-writer engine — the transaction is the lock */
  }
  async tx<T>(fn: (t: Dbx) => Promise<T>): Promise<T> {
    if (this.db.inTransaction) return fn(this);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

/* ---------------- Postgres driver ---------------- */

function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

class PgDbx implements Dbx {
  constructor(
    private pool: Pool,
    private client: PoolClient | null = null
  ) {}

  private q(sql: string, params: unknown[]) {
    return (this.client ?? this.pool).query(toPgPlaceholders(sql), params);
  }

  async get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await this.q(sql, params)).rows[0] as T | undefined;
  }
  async all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.q(sql, params)).rows as T[];
  }
  async run(sql: string, params: unknown[] = []): Promise<number> {
    return (await this.q(sql, params)).rowCount ?? 0;
  }
  async lockSlot(date: string, hour: number): Promise<void> {
    await this.q("SELECT pg_advisory_xact_lock(hashtext(?))", [`${date}:${hour}`]);
  }
  async tx<T>(fn: (t: Dbx) => Promise<T>): Promise<T> {
    if (this.client) return fn(this); // already inside a transaction
    const client = await this.pool.connect();
    const scoped = new PgDbx(this.pool, client);
    try {
      await client.query("BEGIN");
      const result = await fn(scoped);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

/* ---------------- Schema ---------------- */

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_member INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    waiver_accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(date, hour);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_user_slot
    ON bookings(user_id, date, hour) WHERE status = 'confirmed';

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(requester_id, addressee_id)
  );

  CREATE TABLE IF NOT EXISTS login_challenges (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    units INTEGER NOT NULL DEFAULT 3,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_slot ON team_blocks(date, hour);
  CREATE INDEX IF NOT EXISTS idx_blocks_batch ON team_blocks(batch_id);

  CREATE TABLE IF NOT EXISTS login_attempts (
    email TEXT PRIMARY KEY,
    fails INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_member INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    waiver_accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (now()::text)
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(date, hour);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_user_slot
    ON bookings(user_id, date, hour) WHERE status = 'confirmed';

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (now()::text),
    UNIQUE(requester_id, addressee_id)
  );

  CREATE TABLE IF NOT EXISTS login_challenges (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_blocks (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    batch_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    units INTEGER NOT NULL DEFAULT 3,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text)
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_slot ON team_blocks(date, hour);
  CREATE INDEX IF NOT EXISTS idx_blocks_batch ON team_blocks(batch_id);

  CREATE TABLE IF NOT EXISTS login_attempts (
    email TEXT PRIMARY KEY,
    fails INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (now()::text)
  );
`;

/* ---------------- Init & seed ---------------- */

declare global {
  // eslint-disable-next-line no-var
  var __dbx: Promise<Dbx> | undefined;
}

export function getDb(): Promise<Dbx> {
  if (!global.__dbx) global.__dbx = init();
  return global.__dbx;
}

async function init(): Promise<Dbx> {
  const url = databaseUrl();
  if (url) {
    const pool = new Pool({
      connectionString: url,
      max: 5, // serverless-friendly; use Neon's pooled connection string
      ssl: { rejectUnauthorized: true },
    });
    const dbx = new PgDbx(pool);
    for (const stmt of PG_SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
      await dbx.run(stmt);
    }
    await seedProduction(dbx);
    return dbx;
  }

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const raw = new Database(path.join(dataDir, "app.db"));
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.exec(SQLITE_SCHEMA);
  migrateSqlite(raw);
  const dbx = new SqliteDbx(raw);
  await seedDemo(dbx);
  return dbx;
}

// Additive column migrations for local databases created before new columns.
function migrateSqlite(db: Database.Database) {
  const cols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes("totp_secret")) db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT");
  if (!cols.includes("totp_enabled"))
    db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("waiver_accepted_at"))
    db.exec("ALTER TABLE users ADD COLUMN waiver_accepted_at TEXT");
}

// Production (Postgres): create only the staff account, from env if provided.
async function seedProduction(db: Dbx) {
  const count = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
  if (Number(count?.c) > 0) return;
  const email = (process.env.ADMIN_EMAIL ?? "admin@480hitting.co").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin480!";
  await db.run(
    `INSERT INTO users (email, name, password_hash, role, is_member, waiver_accepted_at)
     VALUES (?, ?, ?, 'admin', 1, ?)`,
    [email, "Warren Holzemer", bcrypt.hashSync(password, 10), isoNow()]
  );
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[480] Staff account seeded with the DEFAULT password — set ADMIN_PASSWORD or change it immediately."
    );
  }
}

// Local dev (SQLite): demo accounts and bookings. Credentials in README.md.
async function seedDemo(db: Dbx) {
  const count = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
  if (Number(count?.c) > 0) return;

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const addUser = async (
    email: string,
    name: string,
    pw: string,
    role: string,
    member: number
  ) =>
    (
      await db.get<{ id: number }>(
        `INSERT INTO users (email, name, password_hash, role, is_member, waiver_accepted_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        [email, name, hash(pw), role, member, isoNow()]
      )
    )!.id;

  await addUser("admin@480hitting.co", "Warren Holzemer", "admin480!", "admin", 1);
  const danny = await addUser("danny@demo.com", "Danny Howitz", "demo1234", "user", 1);
  const mike = await addUser("mike@demo.com", "Mike Rivera", "demo1234", "user", 1);
  const sara = await addUser("sara@demo.com", "Sara Chen", "demo1234", "user", 0);
  await addUser("jake@demo.com", "Jake Ortiz", "demo1234", "user", 0);

  await db.run(
    "INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'accepted')",
    [danny, mike]
  );
  await db.run(
    "INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')",
    [sara, danny]
  );

  const now = phoenixNow();
  const day = (n: number) => localKey(addDays(now, n));
  const book = (userId: number, date: string, hour: number, price: number) =>
    db.run("INSERT INTO bookings (user_id, date, hour, price) VALUES (?, ?, ?, ?)", [
      userId,
      date,
      hour,
      price,
    ]);
  await book(danny, day(1), 17, 75);
  await book(danny, day(1), 18, 75);
  await book(mike, day(1), 17, 75);
  await book(sara, day(2), 10, 100);
  await book(danny, day(12), 17, 75);
  await book(mike, day(5), 18, 75);
}

/* ---------------- Shared helpers ---------------- */

// Units consumed in one slot: customer bookings plus team-block holds.
export async function slotUsage(
  db: Dbx,
  date: string,
  hour: number
): Promise<{ booked: number; blocked: number; used: number }> {
  const booked = Number(
    (
      await db.get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM bookings
         WHERE date = ? AND hour = ? AND status = 'confirmed'`,
        [date, hour]
      )
    )?.c ?? 0
  );
  const blocked = Number(
    (
      await db.get<{ u: number }>(
        `SELECT COALESCE(SUM(units), 0) AS u FROM team_blocks
         WHERE date = ? AND hour = ?`,
        [date, hour]
      )
    )?.u ?? 0
  );
  return { booked, blocked, used: booked + blocked };
}
