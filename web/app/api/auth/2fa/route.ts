import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { generateSecret, otpauthUrl, verifyTotp } from "@/lib/totp";

// Manage 2FA on the logged-in account.
//   action: "setup"   -> generate a secret (not active until confirmed)
//   action: "confirm" -> verify a code against the pending secret, turn 2FA on
//   action: "disable" -> verify a code, turn 2FA off
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const action: string = body?.action ?? "";
  const db = await getDb();
  const row = await db.get<{ totp_secret: string | null; totp_enabled: number }>(
    "SELECT totp_secret, totp_enabled FROM users WHERE id = ?",
    [user.id]
  );

  if (action === "setup") {
    if (row?.totp_enabled) {
      return NextResponse.json(
        { error: "Two-factor is already enabled." },
        { status: 400 }
      );
    }
    const secret = generateSecret();
    await db.run("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?", [
      secret,
      user.id,
    ]);
    return NextResponse.json({
      secret,
      otpauth: otpauthUrl(user.email, secret),
    });
  }

  if (action === "confirm") {
    if (!row?.totp_secret || row.totp_enabled) {
      return NextResponse.json({ error: "Nothing to confirm." }, { status: 400 });
    }
    if (!verifyTotp(row.totp_secret, body?.code ?? "")) {
      return NextResponse.json(
        { error: "That code didn't match — check your authenticator app and try again." },
        { status: 400 }
      );
    }
    await db.run("UPDATE users SET totp_enabled = 1 WHERE id = ?", [user.id]);
    return NextResponse.json({ ok: true });
  }

  if (action === "disable") {
    if (!row?.totp_enabled) {
      return NextResponse.json({ error: "Two-factor is not enabled." }, { status: 400 });
    }
    if (!verifyTotp(row.totp_secret!, body?.code ?? "")) {
      return NextResponse.json(
        { error: "That code didn't match — 2FA stays on." },
        { status: 400 }
      );
    }
    await db.run(
      "UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?",
      [user.id]
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
