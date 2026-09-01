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
  const hour: number = body?.hour;
  const now = phoenixNow();

  const windowError = bookingWindowError(user, date, hour, now);
  if (windowError) {
    return NextResponse.json({ error: windowError }, { status: 400 });
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

  // Reserve the unit (pending if paying online, confirmed if desk-pay mode).
  const payOnline = paymentsEnabled();
  let bookingId: number;
  try {
    bookingId = await db.tx(async (t) => {
      await t.lockSlot(date, hour);
      const taken = (await slotUsage(t, date, hour)).used;
      if (taken >= facility.capacityPerHour) throw new Error("FULL");

      const dup = await t.get(
        `SELECT id FROM bookings
         WHERE user_id = ? AND date = ? AND hour = ?
           AND (status = 'confirmed' OR (status = 'pending' AND expires_at > ?))`,
        [user.id, date, hour, isoNow()]
      );
      if (dup) throw new Error("DUP");

      const created = await t.get<{ id: number }>(
        `INSERT INTO bookings (user_id, date, hour, price, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          user.id,
          date,
          hour,
          price,
          payOnline ? "pending" : "confirmed",
          payOnline ? isoNow(HOLD_MINUTES * 60 * 1000) : null,
        ]
      );
      return created!.id;
    });
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

  if (!payOnline) {
    return NextResponse.json({ id: bookingId, price });
  }

  // --- Online payment path ---
  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(db, user);
  const label = `Hitting Session — ${formatDayLong(dateFromKey(date))} ${formatHour(hour)}`;

  // One tap: charge the saved card off-session if there is one.
  const savedCard = await getSavedCard(customerId);
  if (savedCard) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        customer: customerId,
        payment_method: savedCard.id,
        off_session: true,
        confirm: true,
        description: label,
        metadata: { type: "booking", bookingId: String(bookingId), userId: String(user.id) },
      });
      if (intent.status === "succeeded") {
        await confirmBookingPaid(db, bookingId, intent.id);
        return NextResponse.json({
          id: bookingId,
          price,
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
          unit_amount: price * 100,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: { type: "booking", bookingId: String(bookingId), userId: String(user.id) },
    },
    metadata: { type: "booking", bookingId: String(bookingId), userId: String(user.id) },
    success_url: `${origin}/book?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book?canceled=1&booking=${bookingId}`,
    expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
  });
  await (await getDb()).run(
    "UPDATE bookings SET stripe_session_id = ? WHERE id = ?",
    [session.id, bookingId]
  );
  return NextResponse.json({ id: bookingId, price, checkoutUrl: session.url });
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
    status: string;
    stripe_payment_intent: string | null;
  }>(
    `SELECT id, date, hour, status, stripe_payment_intent FROM bookings
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
      await getStripe().refunds.create({
        payment_intent: row.stripe_payment_intent,
      });
      refunded = true;
    } catch {
      // Already refunded or unpaid intent — booking stays canceled either way.
    }
  }
  return NextResponse.json({ ok: true, refunded });
}
