import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { addDays, localKey } from "@/lib/schedule";
import { phoenixNow } from "@/lib/time";

// Staff-only: accounts with upcoming booking counts, plus topline stats.
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const db = await getDb();
  const now = phoenixNow();
  const today = localKey(now);
  const weekOut = localKey(addDays(now, 6));

  const users = await db.all(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_member AS "isMember",
            (SELECT COUNT(*) FROM bookings b
              WHERE b.user_id = u.id AND b.status = 'confirmed' AND b.date >= ?) AS upcoming
     FROM users u ORDER BY u.name`,
    [today]
  );

  const week = await db.get<{ count: number; revenue: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue
     FROM bookings WHERE status = 'confirmed' AND date BETWEEN ? AND ?`,
    [today, weekOut]
  );
  const todayCount = await db.get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bookings WHERE status = 'confirmed' AND date = ?`,
    [today]
  );
  const members = await db.get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM users WHERE is_member = 1"
  );

  return NextResponse.json({
    users: users.map((u) => ({ ...u, upcoming: Number(u.upcoming) })),
    stats: {
      bookingsToday: Number(todayCount?.c ?? 0),
      bookings7d: Number(week?.count ?? 0),
      revenue7d: Number(week?.revenue ?? 0),
      members: Number(members?.c ?? 0),
    },
  });
}

// Staff-only account actions:
//   { userId, isMember }                  -> toggle membership (manual path
//                                            until Stripe subscriptions)
//   { userId, action: "setPassword", tempPassword } -> front-desk password
//                                            reset; logs out their sessions
//   { userId, action: "reset2fa" }        -> clear 2FA (lost phone)
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const db = await getDb();
  const target = await db.get("SELECT id FROM users WHERE id = ?", [userId]);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (body?.action === "setPassword") {
    const tempPassword: string = body?.tempPassword ?? "";
    if (tempPassword.length < 8) {
      return NextResponse.json(
        { error: "Temp password must be at least 8 characters." },
        { status: 400 }
      );
    }
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [
      bcrypt.hashSync(tempPassword, 10),
      userId,
    ]);
    await db.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "reset2fa") {
    await db.run(
      "UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?",
      [userId]
    );
    return NextResponse.json({ ok: true });
  }

  const isMember = body?.isMember ? 1 : 0;
  await db.run("UPDATE users SET is_member = ? WHERE id = ?", [isMember, userId]);
  return NextResponse.json({ ok: true });
}
