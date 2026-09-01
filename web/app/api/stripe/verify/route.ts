import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { activateMembership, confirmBookingPaid, getStripe, paymentsEnabled } from "@/lib/stripe";

// Called when the customer lands back from Stripe Checkout. Verifies the
// session server-side (never trusts the redirect itself) and finalizes the
// booking or membership. The webhook does the same thing authoritatively;
// both paths are idempotent.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  if (!paymentsEnabled()) {
    return NextResponse.json({ error: "Payments not configured." }, { status: 501 });
  }
  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.userId !== String(user.id)) {
    return NextResponse.json({ error: "Not your session." }, { status: 403 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ paid: false });
  }

  const db = await getDb();
  if (session.metadata?.type === "booking") {
    const bookingId = Number(session.metadata.bookingId);
    await confirmBookingPaid(
      db,
      bookingId,
      typeof session.payment_intent === "string" ? session.payment_intent : null
    );
    return NextResponse.json({ paid: true, type: "booking" });
  }
  if (session.metadata?.type === "membership") {
    await activateMembership(
      db,
      user.id,
      typeof session.subscription === "string" ? session.subscription : null
    );
    return NextResponse.json({ paid: true, type: "membership" });
  }
  return NextResponse.json({ paid: true, type: "unknown" });
}
