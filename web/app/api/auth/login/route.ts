import crypto from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, isoNow } from "@/lib/db";
import { startSession, rowToUser } from "@/lib/auth";

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";

  const db = await getDb();

  // Brute-force guard: MAX_FAILS bad attempts locks the email for 15 minutes.
  const attempt = await db.get<{
    fails: number;
    locked_until: string | null;
    updated_at: string;
  }>("SELECT fails, locked_until, updated_at FROM login_attempts WHERE email = ?", [email]);
  if (attempt?.locked_until && attempt.locked_until > isoNow()) {
    return NextResponse.json(
      { error: "Too many attempts — try again in about 15 minutes." },
      { status: 429 }
    );
  }

  const row = await db.get("SELECT * FROM users WHERE email = ?", [email]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!row || !bcrypt.compareSync(password, (row as any).password_hash)) {
    const windowExpired = !attempt || attempt.updated_at < isoNow(-LOCK_MS);
    const fails = windowExpired ? 1 : attempt.fails + 1;
    const lockedUntil = fails >= MAX_FAILS ? isoNow(LOCK_MS) : null;
    if (attempt) {
      await db.run(
        "UPDATE login_attempts SET fails = ?, locked_until = ?, updated_at = ? WHERE email = ?",
        [fails, lockedUntil, isoNow(), email]
      );
    } else {
      await db.run(
        "INSERT INTO login_attempts (email, fails, locked_until, updated_at) VALUES (?, ?, ?, ?)",
        [email, fails, lockedUntil, isoNow()]
      );
    }
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 }
    );
  }

  await db.run("DELETE FROM login_attempts WHERE email = ?", [email]);

  // Password OK, but 2FA is on: no session yet. Hand back a short-lived
  // challenge token; the session starts only after the code checks out.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((row as any).totp_enabled) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.run(
      "INSERT INTO login_challenges (token, user_id, expires_at) VALUES (?, ?, ?)",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [token, (row as any).id, isoNow(5 * 60 * 1000)]
    );
    return NextResponse.json({ requires2fa: true, token });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await startSession((row as any).id);
  return NextResponse.json({ user: rowToUser(row) });
}
