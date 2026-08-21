import crypto from "crypto";
import { cookies } from "next/headers";
import { getDb, isoNow } from "./db";

const COOKIE = "hc_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: "admin" | "user";
  isMember: boolean;
  twoFactorEnabled: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToUser(r: any): SessionUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    role: r.role,
    isMember: !!r.is_member,
    twoFactorEnabled: !!r.totp_enabled,
  };
}

export async function getUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = await db.get(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    [token, isoNow()]
  );
  return row ? rowToUser(row) : null;
}

export async function startSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const db = await getDb();
  await db.run(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
    [token, userId, isoNow(SESSION_DAYS * 86400 * 1000)]
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.run("DELETE FROM sessions WHERE token = ?", [token]);
  }
  jar.delete(COOKIE);
}
