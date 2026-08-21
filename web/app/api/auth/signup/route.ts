import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, isoNow } from "@/lib/db";
import { startSession, rowToUser } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const email = (body?.email ?? "").trim().toLowerCase();
  const phone = (body?.phone ?? "").trim() || null;
  const password = body?.password ?? "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!body?.acceptWaiver) {
    return NextResponse.json(
      { error: "You must accept the Terms and liability waiver to create an account." },
      { status: 400 }
    );
  }

  const db = await getDb();
  if (await db.get("SELECT id FROM users WHERE email = ?", [email])) {
    return NextResponse.json(
      { error: "An account with that email already exists — try logging in." },
      { status: 409 }
    );
  }

  const created = await db.get<{ id: number }>(
    `INSERT INTO users (email, name, phone, password_hash, waiver_accepted_at)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    [email, name, phone, bcrypt.hashSync(password, 10), isoNow()]
  );

  await startSession(created!.id);
  const row = await db.get("SELECT * FROM users WHERE id = ?", [created!.id]);
  return NextResponse.json({ user: rowToUser(row) });
}
