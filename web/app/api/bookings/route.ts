import { NextResponse } from "next/server";
import { getDb, slotUsage } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { facility } from "@/lib/config";
import { localKey } from "@/lib/schedule";
import { bookingWindowError, rateFor, slotStart } from "@/lib/booking";
import { phoenixNow } from "@/lib/time";

// My upcoming bookings.
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const now = phoenixNow();
  const today = localKey(now);
  const db = await getDb();
  const rows = await db.all(
    `SELECT id, date, hour, price FROM bookings
     WHERE user_id = ? AND status = 'confirmed'
       AND (date > ? OR (date = ? AND hour >= ?))
     ORDER BY date, hour`,
    [user.id, today, today, now.getHours()]
  );
  return NextResponse.json({ bookings: rows });
}

// Book a slot. Capacity is enforced inside a transaction (with a per-slot
// lock on Postgres) so two people can never both take the last spot.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please log in to book." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const date: string = body?.date ?? "";
  const hour: number = body?.hour;
  const now = phoenixNow();

  const windowError = bookingWindowError(user, date, hour, now);
  if (windowError) {
    return NextResponse.json({ error: windowError }, { status: 400 });
  }

  const db = await getDb();

  // Cap upcoming reservations per customer so nobody strip-mines the
  // calendar weeks out. (Staff bookings via the admin API bypass this.)
  const today = localKey(now);
  const upcoming = await db.get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bookings
     WHERE user_id = ? AND status = 'confirmed'
       AND (date > ? OR (date = ? AND hour >= ?))`,
    [user.id, today, today, now.getHours()]
  );
  if (Number(upcoming?.c) >= facility.maxFutureBookings) {
    return NextResponse.json(
      {
        error: `You can hold up to ${facility.maxFutureBookings} upcoming reservations at a time — cancel one or come hit first, then book more.`,
      },
      { status: 400 }
    );
  }

  // Intro rate: a guest account's first-ever booking is $50.
  let price = rateFor(user);
  if (!user.isMember) {
    const prior = await db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM bookings
       WHERE user_id = ? AND status = 'confirmed'`,
      [user.id]
    );
    if (Number(prior?.c) === 0) price = facility.firstSessionRate;
  }

  try {
    const id = await db.tx(async (t) => {
      await t.lockSlot(date, hour);
      const taken = (await slotUsage(t, date, hour)).used;
      if (taken >= facility.capacityPerHour) throw new Error("FULL");

      const dup = await t.get(
        `SELECT id FROM bookings
         WHERE user_id = ? AND date = ? AND hour = ? AND status = 'confirmed'`,
        [user.id, date, hour]
      );
      if (dup) throw new Error("DUP");

      const created = await t.get<{ id: number }>(
        `INSERT INTO bookings (user_id, date, hour, price)
         VALUES (?, ?, ?, ?) RETURNING id`,
        [user.id, date, hour, price]
      );
      return created!.id;
    });

    // Payment: once Stripe is connected this is where the saved card on the
    // account gets charged. Until then the booking records the owed price.
    return NextResponse.json({ id, price });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "FULL") {
      return NextResponse.json(
        { error: "That hour just filled up — pick another slot." },
        { status: 409 }
      );
    }
    if (msg === "DUP") {
      return NextResponse.json(
        { error: "You already have a spot in that hour." },
        { status: 409 }
      );
    }
    throw e;
  }
}

// Cancel my booking (more than 24h before the start).
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  const db = await getDb();
  const row = await db.get<{ id: number; date: string; hour: number }>(
    `SELECT id, date, hour FROM bookings
     WHERE id = ? AND user_id = ? AND status = 'confirmed'`,
    [id, user.id]
  );

  if (!row) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  const hoursUntil =
    (slotStart(row.date, row.hour).getTime() - phoenixNow().getTime()) / 3600000;
  if (hoursUntil < 24) {
    return NextResponse.json(
      { error: "Bookings can only be canceled more than 24 hours out — give us a call." },
      { status: 400 }
    );
  }
  await db.run("UPDATE bookings SET status = 'canceled' WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
