import { NextResponse } from "next/server";
import { getDb, isoNow } from "@/lib/db";
import { startSession, rowToUser } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";

// Second step of login: exchange challenge token + authenticator code for a
// session. Tokens are single-use and expire after 5 minutes.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token: string = body?.token ?? "";
  const code: string = body?.code ?? "";

  const db = await getDb();
  const row = await db.get(
    `SELECT c.attempts, u.* FROM login_challenges c
     JOIN users u ON u.id = c.user_id
     WHERE c.token = ? AND c.expires_at > ?`,
    [token, isoNow()]
  );

  if (!row) {
    return NextResponse.json(
      { error: "Login expired — start over." },
      { status: 401 }
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = row as any;
  if (!u.totp_enabled || !verifyTotp(u.totp_secret, code)) {
    // Cap wrong guesses per challenge so codes can't be brute-forced.
    if (Number(u.attempts) + 1 >= 5) {
      await db.run("DELETE FROM login_challenges WHERE token = ?", [token]);
      return NextResponse.json(
        { error: "Too many wrong codes — start the login over." },
        { status: 429 }
      );
    }
    await db.run(
      "UPDATE login_challenges SET attempts = attempts + 1 WHERE token = ?",
      [token]
    );
    return NextResponse.json(
      { error: "That code didn't match. Try the current code from your app." },
      { status: 401 }
    );
  }

  await db.run("DELETE FROM login_challenges WHERE token = ?", [token]);
  await db.run("DELETE FROM login_challenges WHERE expires_at <= ?", [isoNow()]);
  await startSession(u.id);
  return NextResponse.json({ user: rowToUser(u) });
}
