import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { facility } from "@/lib/config";
import { isValidDateKey } from "@/lib/booking";

// Staff-only: everything occupying one slot — customer bookings and team
// holds — with ids so each can be removed individually.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const hour = Number(url.searchParams.get("hour"));
  if (!isValidDateKey(date) || !Number.isInteger(hour)) {
    return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  }

  const db = await getDb();
  const bookings = await db.all(
    `SELECT b.id, b.price, u.id AS "userId", u.name, u.email, u.is_member AS "isMember"
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.date = ? AND b.hour = ? AND b.status = 'confirmed'
     ORDER BY u.name`,
    [date, hour]
  );
  const blocks = await db.all(
    `SELECT id, team_name AS "teamName", units, note
     FROM team_blocks WHERE date = ? AND hour = ?`,
    [date, hour]
  );
  const used =
    bookings.length + blocks.reduce((s, b) => s + Number(b.units), 0);

  return NextResponse.json({
    date,
    hour,
    bookings,
    blocks,
    open: Math.max(0, facility.capacityPerHour - used),
    capacity: facility.capacityPerHour,
  });
}
