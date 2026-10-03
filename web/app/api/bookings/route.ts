import { NextResponse } from "next/server";
import { cleanupExpiredHolds, getDb, isoNow, slotUsage } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { facility } from "@/lib/config";
import { localKey } from "@/lib/schedule";
import { bookingWindowError, rateFor, slotStart } from "@/lib/booking";
import { phoenixNow } from "@/lib/time";
import {
  confirmBookingPaid,
  getOrCreateCustomer,
  getSavedCard,
  getStripe,
  paymentsEnabled,
} from "@/lib/stripe";
import { formatDayLong, formatHour, dateFromKey } from "@/lib/schedule";

const HOLD_MINUTES = 30; // matches Stripe Checkout's minimum session lifetime

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
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const guests = await db.all(
      `SELECT bg.booking_id AS "bookingId", u.name
       FROM booking_guests bg JOIN users u ON u.id = bg.user_id
       WHERE bg.booking_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    for (const r of rows) {
      r.guests = guests.filter((g) => g.bookingId === r.id).map((g) => g.name);
    }
  }
  return NextResponse.json({ bookings: rows });
}

// Book a slot. With payments on, the slot is HELD (status 'pending') while
// the customer pays; it becomes real only when Stripe confirms the money —
// via the saved-card charge, the redirect verify, or the webhook.
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
  // Preferred: an explicit list of hours (Photos-style multi-select; need
  // not be consecutive). Fallback: hour + duration for older clients.
  let hoursList: number[] = Array.isArray(body?.hours)
    ? [...new Set<number>(body.hours.map((h: unknown) => Number(h)))]
        .filter((h) => Number.isInteger(h))
        .sort((a, b) => a - b)
    : [];
  if (hoursList.length === 0) {
    const hour: number = body?.hour;
    const duration = Math.min(
      Math.max(Number(body?.duration) || 1, 1),
      facility.maxConsecutiveHours
    );
    hoursList = Array.from({ length: duration }, (_, i) => hour + i);
  }
  if (hoursList.length > facility.maxConsecutiveHours) {
    return NextResponse.json(
      { error: `Up to ${facility.maxConsecutiveHours} sessions per checkout.` },
      { status: 400 }
    );
  }
  const duration = hoursList.length;
  const now = phoenixNow();

  // Who they're hitting with: registered accounts only (waivers on file).
  const guestIds: number[] = Array.isArray(body?.guests)
    ? [...new Set<number>(body.guests.map((g: unknown) => Number(g)))]
        .filter((g) => Number.isInteger(g) && g > 0 && g !== user.id)
        .slice(0, facility.hittersPerSession - 1)
    : [];

  // Every hour in the block must clear the same rules (window, operating
  // hours, not past) — this also rejects blocks that run past closing.
  for (const h of hoursList) {
    const windowError = bookingWindowError(user, date, h, now);
    if (windowError) {
      return NextResponse.json({ error: windowError }, { status: 400 });
    }
  }

  const db = await getDb();
  await cleanupExpiredHolds(db);

  // Cap upcoming reservations per customer (staff bookings bypass this).
  const today = localKey(now);
  const upcoming = await db.get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bookings
     WHERE user_id = ? AND status = 'confirmed'
       AND (date > ? OR (date = ? AND hour >= ?))`,
    [user.id, today, today, now.getHours()]
  );
  if (Number(upcoming?.c) + duration > facility.maxFutureBookings) {
    return NextResponse.json(
      {
        error: `You can hold up to ${facility.maxFutureBookings} upcoming reservation hours at a time — cancel one or come hit first, then book more.`,
      },
      { status: 400 }
    );
  }

  // Intro rate: a guest account's first-ever booking is $50 (first hour
  // only on a multi-hour block). Canceled bookings still count as "used" —
  // otherwise cancel-and-rebook would farm the discount repeatedly.
  const baseRate = rateFor(user);
  let firstHourRate = baseRate;
  if (!user.isMember) {
    const prior = await db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM bookings
       WHERE user_id = ? AND status IN ('confirmed', 'canceled')`,
      [user.id]
    );
    if (Number(prior?.c) === 0) firstHourRate = facility.firstSessionRate;
  }
  const perHourPrices = hoursList.map((_, i) => (i === 0 ? firstHourRate : baseRate));
  const totalPrice = perHourPrices.reduce((a, b) => a + b, 0);

  if (guestIds.length > 0) {
    const found = await db.all(
      `SELECT id FROM users WHERE id IN (${guestIds.map(() => "?").join(",")})`,
      guestIds
    );
    if (found.length !== guestIds.length) {
      return NextResponse.json(
        { error: "One of those hitting partners isn't a registered account." },
        { status: 400 }
      );
    }
  }

  // Reserve the whole block atomically (pending if paying online,
  // confirmed if desk-pay mode) — all hours or none.
  const payOnline = paymentsEnabled();
  let bookingIds: number[];
  try {
    bookingIds = await db.tx(async (t) => {
      const ids: number[] = [];
      for (let i = 0; i < hoursList.length; i++) {
        const h = hoursList[i];
        await t.lockSlot(date, h);
        // If THIS user already holds this slot pending payment (e.g. they
        // hit Back from checkout), release their own hold and start fresh.
        await t.run(
          `DELETE FROM bookings
           WHERE user_id = ? AND date = ? AND hour = ? AND status = 'pending'`,
          [user.id, date, h]
        );

        const taken = (await slotUsage(t, date, h)).used;
        if (taken >= facility.capacityPerHour) throw new Error("FULL");

        const dup = await t.get(
          `SELECT id FROM bookings
           WHERE user_id = ? AND date = ? AND hour = ? AND status = 'confirmed'`,
          [user.id, date, h]
        );
        if (dup) throw new Error("DUP");

        const created = await t.get<{ id: number }>(
          `INSERT INTO bookings (user_id, date, hour, price, status, expires_at)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
          [
            user.id,
            date,
            h,
            perHourPrices[i],
            payOnline ? "pending" : "confirmed",
            payOnline ? isoNow(HOLD_MINUTES * 60 * 1000) : null,
          ]
        );
        ids.push(created!.id);
        for (const g of guestIds) {
          await t.run(
            "INSERT INTO booking_guests (booking_id, user_id) VALUES (?, ?)",
            [created!.id, g]
          );
        }
      }
      return ids;
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "FULL") {
      return NextResponse.json(
        {
          error:
            duration > 1
              ? "One of those hours just filled up — adjust your selection."
              : "That hour just filled up — pick another slot.",
        },
        { status: 409 }
      );
    }
    if (msg === "DUP") {
      return NextResponse.json(
        { error: "You already have one of those hours booked." },
        { status: 409 }
      );
    }
    throw e;
  }

  const idsCsv = bookingIds.join(",");

  if (!payOnline) {
    return NextResponse.json({ id: bookingIds[0], ids: bookingIds, price: totalPrice });
  }

  // --- Online payment path ---
  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(db, user);
  const label =
    duration > 1
      ? `Hitting Sessions — ${formatDayLong(dateFromKey(date))}: ${hoursList.map(formatHour).join(", ")}`
      : `Hitting Session — ${formatDayLong(dateFromKey(date))} ${formatHour(hoursList[0])}`;

  // One tap: charge the saved card off-session if there is one.
  const savedCard = await getSavedCard(customerId);
  if (savedCard) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: totalPrice * 100,
        currency: "usd",
        customer: customerId,
        payment_method: savedCard.id,
        off_session: true,
        confirm: true,
        description: label,
        metadata: { type: "booking", bookingIds: idsCsv, userId: String(user.id) },
      });
      if (intent.status === "succeeded") {
        await confirmBookingPaid(db, bookingIds, intent.id);
        return NextResponse.json({
          id: bookingIds[0],
          ids: bookingIds,
          price: totalPrice,
          paid: true,
          card: `${savedCard.card?.brand ?? "card"} •••• ${savedCard.card?.last4 ?? ""}`,
        });
      }
    } catch {
      // Card declined or needs authentication — fall through to Checkout.
    }
  }

  // Otherwise: Stripe Checkout (also saves the card for next time).
  const origin = new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: label },
          unit_amount: totalPrice * 100,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: { type: "booking", bookingIds: idsCsv, userId: String(user.id) },
    },
    metadata: { type: "booking", bookingIds: idsCsv, userId: String(user.id) },
    success_url: `${origin}/book?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book?canceled=1&booking=${idsCsv}`,
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
  });
  for (const bid of bookingIds) {
    await db.run("UPDATE bookings SET stripe_session_id = ? WHERE id = ?", [
      session.id,
      bid,
    ]);
  }
  return NextResponse.json({
    id: bookingIds[0],
    ids: bookingIds,
    price: totalPrice,
    checkoutUrl: session.url,
  });
}

// Cancel my booking. Pending holds release instantly; confirmed bookings
// need >24h notice and are refunded automatically if they were paid online.
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  const db = await getDb();
  const row = await db.get<{
    id: number;
    date: string;
    hour: number;
    price: number;
    status: string;
    stripe_payment_intent: string | null;
  }>(
    `SELECT id, date, hour, price, status, stripe_payment_intent FROM bookings
     WHERE id = ? AND user_id = ? AND status IN ('confirmed', 'pending')`,
    [id, user.id]
  );

  if (!row) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (row.status === "pending") {
    await db.run("DELETE FROM bookings WHERE id = ?", [id]);
    return NextResponse.json({ ok: true, released: true });
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

  let refunded = false;
  if (row.stripe_payment_intent && paymentsEnabled()) {
    try {
      // Refund THIS hour's share — a multi-hour block shares one payment,
      // so each canceled hour refunds its own price.
      await getStripe().refunds.create({
        payment_intent: row.stripe_payment_intent,
        amount: row.price * 100,
      });
      refunded = true;
    } catch {
      // Already refunded or unpaid intent — booking stays canceled either way.
    }
  }
  return NextResponse.json({ ok: true, refunded });
}
