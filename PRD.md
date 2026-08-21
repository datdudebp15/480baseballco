# Hitting Facility Reservation App — PRD (v2)

**Status:** Draft — updated 2026-07-10 with the membership business model. Pending review with Danny Howitz before development starts.

## Business Model (drives everything below)

- **Facility economics:** $450k build-out + $150k lease over 3 years = **$200k/year fixed cost** before staff, utilities, insurance.
- **Capacity:** each clock hour has **3 bookable slots** (3 individuals can use the facility simultaneously). Revenue potential per hour: $225–300.
- **Subscription:** $1,000 buys facility access + the right to reserve up to **3 weeks in advance**.
- **Hourly usage fee:** $75–100 per person per hour, paid at booking (subscription does not include free hours).
- **Public (non-subscriber) access:** open slots become available to non-subscribers once a date is **within 1 week**.
- **Prime-time pricing:** higher hourly rates during peak hours (e.g., weekday evenings, weekends).
- **Team blocks:** teams (e.g., ASU) buy large blocks of time at negotiated rates, arranged directly and entered by admin — and must be booked **at least 30 days in advance**, before the subscriber window opens.
- **Distribution:** offered through Danny Howitz's agency (mechanics TBD — see Open Questions).

### Revenue sanity check
At 12 open hours/day, capacity is ~250 slot-hours/week (~13,000/year → ~$1M/year at $75 if sold out — so the model has headroom). To cover the $200k/year fixed cost:
- 100 subscribers = $100k. The remaining $100k at $75–100/slot-hour = ~1,000–1,300 slot-hours/year ≈ **20–25 slot-hours per week**, or roughly 7–8 fully-booked clock hours a week. Team blocks make this easier.
- Every additional subscriber is nearly pure margin, which is why the app must make the subscription feel valuable (the 3-week window has to be real and reliable).

## Problem Statement

The facility monetizes through two tiers — subscribers who prepay for priority access, and the general public who backfill remaining capacity — plus negotiated team blocks. No off-the-shelf single-resource booking tool handles the tiered booking-window rule (21 days vs. 7 days) cleanly. The app must enforce that rule automatically, sell and track subscriptions, take hourly payments, and never oversell the 3-per-hour capacity.

## Goals

1. Subscribers can reserve any open slot up to 21 days out; non-subscribers only within 7 days — enforced by the system, no honor system.
2. Sell and manage the $1,000 subscription entirely in-app (purchase, renewal, status).
3. Zero overbooking: never more than 3 paid bookings in one clock hour, minus any team-block or maintenance holds.
4. Prime vs. off-peak hourly pricing configurable by the owner without code changes.
5. Owner can enter team blocks that remove capacity from public sale.
6. Cover-the-nut visibility: owner can see subscription count and slot-hours sold against monthly targets.

## Non-Goals (v1)

- **Free-hours-included membership tiers** — subscription is access + booking priority only; bundled hours would complicate everything and can be added later.
- **Team self-service booking** — team deals (ASU etc.) are negotiated in person; admin enters them. A team portal is a P2 idea.
- **Lessons/instructor scheduling** — separate initiative.
- **Native mobile app** — mobile web first.
- **Sub-hour or multi-hour slot types** — 60-minute blocks on the hour.
- **Agency revenue-share automation** — however the Danny Howitz arrangement works, v1 tracks it manually (promo/source codes at most).

## Users

- **Subscriber** — paid $1,000; books up to 21 days ahead; likely serious players/parents booking weekly.
- **Public customer** — no subscription; books open slots ≤7 days out; pays (likely higher) hourly rate. Also the conversion funnel for subscriptions.
- **Team** — offline relationship; appears in the system as admin-entered blocks.
- **Owner/Admin** — manages pricing, subscriptions, blocks, schedule.

## Key Mechanics

### Slot & capacity model
- Every clock hour within operating hours = one **time slot with capacity 3**. A booking consumes 1 unit; a team block consumes 1–3 units (usually 3).
- Overbooking guard: capacity check + payment confirmation are atomic. Two people can race for the last unit; exactly one wins.

### Tiered booking window (the heart of the product)
Three tiers, sequenced so each one picks from what the previous tier left open:
- **Teams (admin-entered): D − 30 days and earlier.** Team blocks are placed at least a month out, before subscribers can book.
- **Subscribers: from D − 21 days.** When their window opens, the calendar already reflects team commitments — what they see is genuinely bookable.
- **Public: from D − 7 days.**
- Non-logged-in visitors see the full 3-week calendar but slots beyond 7 days show as "Members only — join for $1,000/yr" (this is the subscription sales pitch, built into the UI).
- Recommended guardrail: **cap active future reservations per subscriber** (e.g., max 6 unredeemed hours at a time). Without a cap, a handful of subscribers can strip-mine all prime time 3 weeks out and the product breaks for everyone else. Cap is admin-configurable.

### Pricing
- Rates locked 2026-08 after competitive research (Driveline Scottsdale has the same Trajekt at $100/person, ~2 public hrs/week): **$100 guest / $75 member / $50 first session** (one-time, auto-applied to a new guest account's first booking — implemented). Prime-time premium deliberately deferred; post-launch lever is off-peak member discounts to fill dead hours, driven by utilization data.
- Subscription: $1,000 via Stripe, recommended as **annual auto-renewing** (recurring revenue, no re-sell effort each year). Admin can comp/extend/cancel subscriptions.

### Team blocks
- Admin creates a block: date range or recurring pattern (e.g., "Tue/Thu 3–6pm for 10 weeks"), units consumed (1–3 per hour), team name, negotiated price note. Payment handled offline/invoice in v1; the app's job is removing the capacity from sale.
- **30-day rule:** the system enforces that team blocks only cover dates ≥30 days out. Admin can override with an explicit confirmation — useful for filling still-empty hours last-minute — and an inside-30-days block can never displace an existing subscriber/public booking, only consume remaining open units.
- **Volume still matters:** the 30-day rule sequences team bookings ahead of subscribers, but if teams take *all* prime time a month out, subscribers open their window to nothing. Keep an eye on the share of prime-time capacity sold to teams (the P1 dashboard shows this); a formal ceiling can stay a business judgment rather than a system rule for now.

## Requirements

### Must-Have (P0)

**Scheduling & booking**
- Public calendar (3 weeks out) showing per-hour availability (0–3 open), with member-only gating past 7 days.
- Booking flow: pick slot → sign in / guest checkout → pay hourly rate (correct rate auto-selected by tier + time band) → confirmed with email.
- Atomic capacity enforcement; abandoned checkouts release the unit within ~10 minutes.
- Per-subscriber future-booking cap (configurable).

**Accounts & social (added 2026-07-10 — implemented)**
- Login required to book; account holds member status and the database is the live source of truth for the schedule.
- Saved cards per account for one-tap booking — vaulted with Stripe (customer ID on the account); card numbers never touch our servers.
- Roster visibility: members and staff see who is booked in each slot with Member/Guest tags; non-members and logged-out visitors see spot counts only (plus their own friends).
- Friends list: add by email, accept/decline requests; friends see each other's bookings on the schedule so they can book times together.

**Subscriptions**
- Purchase $1,000 subscription in-app via Stripe; account immediately gains the 21-day window and subscriber rate.
- Subscriber accounts required (email login); public customers can guest-checkout.
- Expiry/renewal handling: lapsed subscription reverts the account to public rules.

**Payments**
- Stripe Checkout for hourly bookings and subscriptions; refunds via admin UI.
- Cancellation policy: full refund ≥24h out via self-serve link (window configurable).

**Admin**
- Calendar with all bookings (name, tier, contact), remaining capacity per hour, and team blocks.
- Create/edit team blocks (one-off and recurring), operating hours, price bands and rates, booking-window lengths, subscriber cap.
- 30-day team-block rule enforced with explicit admin override; overrides can only use units still open at that time.
- Subscription management: list, comp, extend, cancel, refund.
- Manual booking entry for phone/walk-in customers.

**Acceptance criteria (the rules that must never break)**
- [ ] Given a slot 10 days out, a non-subscriber cannot book it and a subscriber can.
- [ ] Given a slot 6 days out, both can book it, each at their correct rate for that time band.
- [ ] Given 2 existing bookings + 1 team-block unit in an hour, the hour shows as full and no further booking can be paid for.
- [ ] Given three simultaneous checkouts for the last unit, exactly one payment completes.
- [ ] Given a subscription that expired yesterday, that account today sees the 7-day public window and public rates.
- [ ] Given a subscriber at their future-booking cap, the next booking attempt is blocked with a clear message.
- [ ] Given a team-block request covering a date 20 days out, admin sees a warning and must explicitly override; the block only takes units still open and never cancels an existing booking.

### Nice-to-Have (P1 — fast follows)

- Reminder email/SMS 24h before a booking.
- Waitlist: notify subscribers when a slot inside their window frees up (pairs well with prepaid no-refund inside 24h — canceled prime slots resell themselves).
- Utilization & revenue dashboard: slot-hours sold, revenue by tier (subscription / hourly / team), vs. monthly break-even target.
- Promo/source codes (e.g., a Howitz-agency signup link) to track where subscribers come from.
- Multi-hour booking in one checkout.

### Future Considerations (P2)

- Subscription tiers (family plans, included hours, off-peak-only cheaper tier).
- Team self-service portal with invoicing.
- Lessons layered on top (instructor availability × slot availability).
- Additional facilities/resources — capacity model already generalizes (a slot's capacity is data, not code).

## Success Metrics

- **Leading:** subscription purchases in first 60 days (set a target with Danny — e.g., 50); booking completion rate ≥70%; % of prime-time slot-hours sold.
- **Lagging:** monthly revenue vs. $16.7k/month break-even; subscriber renewal rate; public→subscriber conversion rate.

## Recommended Stack (unchanged)

Next.js + Postgres + Stripe (Checkout + Billing for subscriptions) + transactional email. Runs ~$0–20/month + Stripe fees. The tiered-window and capacity logic is exactly the kind of custom rule that justifies building rather than renting Mindbody/etc.

## Open Questions

1. **The $75 vs $100 split** — is it subscriber-vs-public rate, off-peak-vs-prime, or both? (Owner — before launch, not before dev.)
2. **Is $1,000 annual, or one-time lifetime?** Recommend annual auto-renew. (Owner/Danny — affects Stripe setup, decide before dev of the subscription piece.)
3. **Danny Howitz arrangement** — is the agency a marketing channel (promo link + manual tracking is enough) or a reseller taking a cut (needs revenue-share accounting — bigger scope)? (Owner + Danny — blocking for the subscription-sales design only.)
4. **Team-block ceiling** — the 30-day rule sequences teams ahead of subscribers, but how much total prime time are you willing to sell them? Informal judgment is fine for v1. (Owner/Danny.)
5. **What does one "slot" physically get you** — a dedicated lane/machine, or shared space? Affects wording in the UI and whether slots are interchangeable. (Owner.)
6. **Subscriber future-booking cap** — right number to start? Suggest 6 hours. (Owner.)
7. Operating hours, waiver requirement, business Stripe account — carried over from v1.

## Phasing

- **Phase 1:** hourly booking with capacity-3 slots, both windows enforced, subscriptions sold in-app, admin blocks & pricing. Launchable.
- **Phase 2:** reminders, waitlist, dashboard vs. break-even, promo tracking for the agency channel.
- **Phase 3:** tiers, team portal, lessons.
