import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getMembershipPriceId, getOrCreateCustomer, getStripe, paymentsEnabled } from "@/lib/stripe";

// Start the $1,000/yr membership subscription checkout. Card by default;
// bank debit (ACH — much lower fees) offered when the account supports it.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  if (user.isMember) {
    return NextResponse.json({ error: "You're already a member." }, { status: 400 });
  }
  if (!paymentsEnabled()) {
    return NextResponse.json(
      { error: "Online membership checkout isn't live yet — call or text (703) 755-5977." },
      { status: 501 }
    );
  }

  const db = await getDb();
  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(db, user);
  const priceId = await getMembershipPriceId();
  const origin = new URL(req.url).origin;

  const base = {
    mode: "subscription" as const,
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { type: "membership", userId: String(user.id) },
    subscription_data: { metadata: { type: "membership", userId: String(user.id) } },
    success_url: `${origin}/account?activated=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?canceled=1`,
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      ...base,
      payment_method_types: ["card", "us_bank_account"],
    });
  } catch {
    // ACH not enabled on this Stripe account — card only.
    session = await stripe.checkout.sessions.create({
      ...base,
      payment_method_types: ["card"],
    });
  }
  return NextResponse.json({ checkoutUrl: session.url });
}
