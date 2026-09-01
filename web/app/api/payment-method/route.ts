import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getSavedCard, getStripe, paymentsEnabled } from "@/lib/stripe";

// The card saved to my account (stored by Stripe, never by us).
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  if (!paymentsEnabled()) {
    return NextResponse.json({ card: null, paymentsEnabled: false });
  }
  const db = await getDb();
  const row = await db.get<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id = ?",
    [user.id]
  );
  if (!row?.stripe_customer_id) {
    return NextResponse.json({ card: null, paymentsEnabled: true });
  }
  const card = await getSavedCard(row.stripe_customer_id);
  return NextResponse.json({
    paymentsEnabled: true,
    card: card?.card
      ? {
          brand: card.card.brand,
          last4: card.card.last4,
          expMonth: card.card.exp_month,
          expYear: card.card.exp_year,
        }
      : null,
  });
}

// Remove my saved card.
export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  if (!paymentsEnabled()) {
    return NextResponse.json({ error: "Payments not configured." }, { status: 501 });
  }
  const db = await getDb();
  const row = await db.get<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id = ?",
    [user.id]
  );
  if (row?.stripe_customer_id) {
    const card = await getSavedCard(row.stripe_customer_id);
    if (card) await getStripe().paymentMethods.detach(card.id);
  }
  return NextResponse.json({ ok: true });
}
