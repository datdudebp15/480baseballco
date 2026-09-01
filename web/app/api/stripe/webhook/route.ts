import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { audit, getDb } from "@/lib/db";
import { activateMembership, confirmBookingPaid, getStripe, paymentsEnabled } from "@/lib/stripe";

// Stripe's server-to-server notifications — the authoritative record of
// money moving. Signature-verified; without the signing secret configured
// this endpoint stays off.
export async function POST(req: Request) {
  if (!paymentsEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }
  const signature = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  const db = await getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      if (session.metadata?.type === "booking") {
        await confirmBookingPaid(
          db,
          Number(session.metadata.bookingId),
          typeof session.payment_intent === "string" ? session.payment_intent : null
        );
      } else if (session.metadata?.type === "membership") {
        await activateMembership(
          db,
          Number(session.metadata.userId),
          typeof session.subscription === "string" ? session.subscription : null
        );
        await audit(db, "stripe", "membership.paid", `user #${session.metadata.userId}`);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type === "booking") {
      // Customer abandoned checkout — release the held slot immediately.
      await db.run("DELETE FROM bookings WHERE id = ? AND status = 'pending'", [
        Number(session.metadata.bookingId),
      ]);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const row = await db.get<{ id: number }>(
      "SELECT id FROM users WHERE stripe_subscription_id = ?",
      [sub.id]
    );
    if (row) {
      await db.run(
        "UPDATE users SET is_member = 0, member_since = NULL, stripe_subscription_id = NULL WHERE id = ?",
        [row.id]
      );
      await audit(db, "stripe", "membership.ended", `user #${row.id} (subscription canceled)`);
    }
  }

  return NextResponse.json({ received: true });
}
