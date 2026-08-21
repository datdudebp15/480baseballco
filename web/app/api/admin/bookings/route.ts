import { NextResponse } from "next/server";
import { getDb, slotUsage } from "@/lib/db";
import { getUser, rowToUser } from "@/lib/auth";
import { facility } from "@/lib/config";
import { localKey } from "@/lib/schedule";
import { isValidDateKey, rateFor, slotStart } from "@/lib/booking";
import { phoenixNow } from "@/lib/time";

async function requireAdmin() {
  const user = await getUser();
  return user && user.role === "admin" ? user : null;
}

// Staff-only: one account's upcoming bookings.
export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const userId = Number(new URL(req.url).searchParams.get("userId"));
  const db = await getDb();
  const row = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!row) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  const now = phoenixNow();
  const today = localKey(now);
  const bookings = await db.all(
    `SELECT id, date, hour, price FROM bookings
     WHERE user_id = ? AND status = 'confirmed'
       AND (date > ? OR (date = ? AND hour >= ?))
     ORDER BY date, hour`,
    [userId, today, today, now.getHours()]
  );
  return NextResponse.json({ user: rowToUser(row), bookings });
}

// Staff-only: book a slot on a customer's behalf. Booking windows do not
// apply (front-desk override) but capacity and duplicates still do.
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const date: string = body?.date ?? "";
  const hour: number = body?.hour;
  const now = phoenixNow();

  const db = await getDb();
  const row = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!row) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (!isValidDateKey(date) || !Number.isInteger(hour)) {
    return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  }
  if (hour < facility.openHour || hour >= facility.closeHour) {
    return NextResponse.json(
      { error: "That hour is outside operating hours." },
      { status: 400 }
    );
  }
  if (slotStart(date, hour) <= now) {
    return NextResponse.json(
      { error: "That time has already passed." },
      { status: 400 }
    );
  }

  const target = rowToUser(row);
  const price = rateFor(target);
  try {
    const id = await db.tx(async (t) => {
      await t.lockSlot(date, hour);
      const taken = (await slotUsage(t, date, hour)).used;
      if (taken >= facility.capacityPerHour) throw new Error("FULL");
      const dup = await t.get(
        `SELECT id FROM bookings
         WHERE user_id = ? AND date = ? AND hour = ? AND status = 'confirmed'`,
        [userId, date, hour]
      );
      if (dup) throw new Error("DUP");
      const created = await t.get<{ id: number }>(
        `INSERT INTO bookings (user_id, date, hour, price)
         VALUES (?, ?, ?, ?) RETURNING id`,
        [userId, date, hour, price]
      );
      return created!.id;
    });
    return NextResponse.json({ id, price });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "FULL") {
      return NextResponse.json({ error: "That hour is full." }, { status: 409 });
    }
    if (msg === "DUP") {
      return NextResponse.json(
        { error: `${target.name} already has a spot in that hour.` },
        { status: 409 }
      );
    }
    throw e;
  }
}

// Staff-only: cancel any booking, no 24-hour restriction.
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  const db = await getDb();
  const changes = await db.run(
    "UPDATE bookings SET status = 'canceled' WHERE id = ? AND status = 'confirmed'",
    [id]
  );
  if (changes === 0) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
