# 480 Hitting Co. — Launch Checklist

Goal: fully functional, public, taking real money. Updated 2026-08-18.
Rule of thumb: **Phase 1 is all you; everything after is mostly me.**

---

## ✅ Already done (built & tested locally)

- [x] Booking engine: 21-day calendar, 3 spots/hour, member (21-day) vs public (7-day) windows enforced server-side
- [x] Accounts, login, 2FA (authenticator app), password change, login rate-limiting
- [x] Rates wired: $100 guest / $75 member / **$50 first session (auto)**
- [x] Friends list + roster visibility (members see who's booked)
- [x] Staff dashboard: stats, occupancy, account manager (move customers in/out of slots, membership toggle, temp password, 2FA reset)
- [x] Team blocks: recurring patterns, 30-day rule with override, never displaces bookings
- [x] Waiver acceptance at signup + DRAFT waiver/terms/privacy pages
- [x] Arizona-pinned clock, secure production cookies, demo-purge script
- [x] Marketing site ↔ app cross-links (localhost for now)
- [x] Pricing validated vs market (Driveline parity; see PRD)

---

## Phase 1 — Accounts & paperwork (YOU — start now, everything else waits on these)

- [ ] **Business bank account** — longest lead time; unblocks Stripe. START FIRST.
- [ ] **Stripe account** (needs the bank account) — stripe.com, business profile
- [ ] **Buy the domain** (480hitting.co or your pick, ~$30/yr — Cloudflare or Namecheap)
- [ ] **Vercel account** (free) — vercel.com, sign up with GitHub or email
- [ ] **Neon account** (free) — neon.tech → create project → copy the `postgres://…` connection string → **paste it to me in chat**
- [ ] **Resend account** (free tier) — resend.com, for booking/confirmation emails; I'll give you 2 DNS records to add once the domain exists
- [ ] **Lawyer**: real liability waiver + review of terms/privacy drafts
- [ ] (Parallel, outside the app: insurance, entity/lease requirements)

## Phase 2 — Database & public deploy (ME — needs Neon + Vercel)

- [x] Port the data layer SQLite → Postgres *(2026-08 — dual-driver: SQLite locally, Postgres auto-activates when DATABASE_URL is set; per-slot advisory locks preserve the no-double-booking guarantee; production build verified)*
- [ ] Validate the Postgres path against the real Neon database (needs your connection string)
- [ ] Deploy the app to Vercel (env vars, TZ=America/Phoenix, production cookies)
- [ ] Deploy the marketing site
- [ ] Wire the domain: site at root, app at `book.` subdomain; swap all localhost links
- [ ] Purge demo accounts; you set a new staff password + enable 2FA on it
- **Milestone: public URL you can send Danny.**

## Phase 3 — Payments (ME — needs Stripe)

- [ ] Stripe Checkout on booking (charges $50/$75/$100 correctly)
- [ ] Saved cards (Stripe customer vault) → one-tap rebooking
- [ ] $1,000 membership as auto-renewing subscription — **decide: annual vs $99/mo** (Danny convo)
- [ ] ACH/bank-payment option on membership (fee capped at $5 vs ~$36 on card)
- [ ] Webhooks: booking confirmed only when payment succeeds; auto-refund on valid (>24h) cancellation
- [ ] Keep front-desk path: staff can still toggle membership for check/Zelle payers
- **Milestone: the app takes real money.**

## Phase 4 — Email (ME — needs domain + Resend)

- [ ] Booking confirmation + cancellation + receipt emails
- [ ] Password reset ("forgot password") flow
- [ ] Day-before reminder emails (can slip to post-launch)

## Phase 5 — Launch gate (JOINT)

- [ ] Swap DRAFT legal pages for counsel-reviewed text
- [ ] Danny decisions locked: membership billing (annual/monthly), agency role (link vs revenue share), team prime-time ceiling
- [ ] End-to-end dress rehearsal: real signup, real card, real booking, real refund, on a phone
- [ ] Change/confirm staff credentials; final demo-data purge
- [ ] **GO LIVE** — announce the $50 first-session offer

## Post-launch backlog (earn their way in with data)

- SMS reminders · waitlist for freed prime slots · revenue dashboard vs $16.7k/mo break-even · 10-packs / heavy-user tier · off-peak member discount · Stripe Connect platform play (other facilities)

---

**Critical path:** bank account → Stripe → payments. Everything else can overlap.
**Fastest visible win:** Neon + Vercel signups (~10 min) → I ship the public demo URL this week.
