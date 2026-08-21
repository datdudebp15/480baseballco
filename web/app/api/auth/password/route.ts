import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Change my password. Requires the current password; all OTHER sessions are
// logged out so a stolen session can't ride along after a reset.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const current: string = body?.current ?? "";
  const next: string = body?.next ?? "";

  if (next.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const row = await db.get<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    [user.id]
  );
  if (!row || !bcrypt.compareSync(current, row.password_hash)) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 401 }
    );
  }

  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [
    bcrypt.hashSync(next, 10),
    user.id,
  ]);

  const myToken = (await cookies()).get("hc_session")?.value;
  await db.run("DELETE FROM sessions WHERE user_id = ? AND token != ?", [
    user.id,
    myToken ?? "",
  ]);
  return NextResponse.json({ ok: true });
}
