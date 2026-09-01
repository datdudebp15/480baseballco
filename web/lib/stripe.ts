import Stripe from "stripe";
import { facility } from "./config";
import { isoNow, type Dbx } from "./db";
import type { SessionUser } from "./auth";

// Payments are feature-flagged on the presence of the secret key: with no
// key (e.g. local dev), bookings confirm immediately and are paid at the
// desk — exactly the pre-Stripe behavior.
export function paymentsEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}

// Each account maps to one Stripe customer; created lazily on first payment.
export async function getOrCreateCustomer(
  db: Dbx,
  user: SessionUser
): Promise<string> {
  const row = await db.get<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id = ?",
    [user.id]
  );
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { appUserId: String(user.id) },
  });
  await db.run("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [
    customer.id,
    user.id,
  ]);
  return customer.id;
}

// The customer's saved card, if any (saved automatically on first checkout).
export async function getSavedCard(customerId: string) {
  const methods = await getStripe().paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return methods.data[0] ?? null;
}

// The $1,000/yr membership price, created once in the Stripe account and
// found by lookup key on subsequent calls.
const MEMBERSHIP_LOOKUP_KEY = "480-membership-annual";
let cachedPriceId: string | null = null;

export async function getMembershipPriceId(): Promise<string> {
  if (cachedPriceId) return cachedPriceId;
  const stripe = getStripe();
  const existing = await stripe.prices.list({
    lookup_keys: [MEMBERSHIP_LOOKUP_KEY],
    limit: 1,
  });
  if (existing.data[0]) {
    cachedPriceId = existing.data[0].id;
    return cachedPriceId;
  }
  const product = await stripe.products.create({
    name: "480 Hitting Co. Membership",
    description:
      "Annual membership: 21-day booking window, member rates, roster access.",
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: facility.subscriptionPrice * 100,
    currency: "usd",
    recurring: { interval: "year" },
    lookup_key: MEMBERSHIP_LOOKUP_KEY,
  });
  cachedPriceId = price.id;
  return cachedPriceId;
}

// Mark a pending booking paid/confirmed. Idempotent — safe to call from both
// the redirect-verify path and the webhook.
export async function confirmBookingPaid(
  db: Dbx,
  bookingId: number,
  paymentIntentId: string | null
): Promise<boolean> {
  const changes = await db.run(
    `UPDATE bookings SET status = 'confirmed', stripe_payment_intent = ?
     WHERE id = ? AND status = 'pending'`,
    [paymentIntentId, bookingId]
  );
  return changes > 0;
}

// Activate membership from a completed subscription checkout. Idempotent.
export async function activateMembership(
  db: Dbx,
  userId: number,
  subscriptionId: string | null
): Promise<void> {
  await db.run(
    `UPDATE users SET is_member = 1,
       member_since = COALESCE(member_since, ?),
       stripe_subscription_id = ?
     WHERE id = ?`,
    [isoNow(), subscriptionId, userId]
  );
}
