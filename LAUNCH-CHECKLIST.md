# 480 Hitting Co. — Launch Checklist

Updated end of August 2026. Live site: **https://480baseballco-homescoutt.vercel.app**

---

## ✅ Done

**Product (all live, all tested):** booking engine (21-day member / 7-day guest windows, 3 spots/hr, no double-booking), membership-gated accounts (no self-signup — everything routes to (703) 755-5977), staff dashboard (stats, occupancy, add/delete accounts, temp passwords, 2FA resets, per-account booking manager, click-any-slot management panel), team blocks (recurring, 30-day rule, per-hour removal), friends + roster visibility, 2FA, login rate-limiting, $50 first session (auto), 6-booking cap per customer, Add-to-Calendar files, pricing hidden from the public, brand site + app on one URL, favicon/404/skeleton/month-labels/availability-counts polish.

**Infrastructure:** Vercel (auto-deploys from GitHub `datdudebp15/480baseballco`), Neon Postgres, staff account = wholzemer@hrfunding.com (old default admin deleted).

---

## 🟥 YOU — critical path (order matters)

- [ ] **Business bank account → Stripe account.** Gates all payments. Longest lead time — START FIRST.
- [ ] **2FA everywhere:** your staff login on the live site, your Vercel account, your GitHub account. Biggest real security gap left; 10 minutes total.
- [ ] **Buy the domain** (480hitting.co, ~$30/yr) — unlocks email + the real URL.
- [ ] **Danny meeting** — settles: membership billing (annual vs $99/mo), agency role (marketing link vs revenue share), team prime-time ceiling. Demo link is ready to send today.
- [ ] **Lawyer:** real liability waiver + review of the draft Terms/Privacy pages.
- [ ] **Facility photos/video** → the "Photos coming soon" tiles on /about.
- [ ] Nice-to-haves: a **480-area-code number** (Google Voice, forwards to your phone — on-brand + local trust); free **uptime monitor** (UptimeRobot pinging `/api/health` — I'll give you the URL).

## 🟨 ME — unblocked ✅ ALL DONE (end of Aug 2026)

- [x] **Security batch:** Next.js 16 (zero npm advisories), 2FA code attempts capped at 5 per challenge, cross-origin write protection middleware, staff audit log (dashboard shows recent activity with who-did-what).
- [x] **Database backup export** — "Download backup ↓" link on the staff dashboard; full JSON snapshot, treat the file as sensitive.
- [x] **Member-since / renewal tracking** — accounts table shows the date; a red "Renewal due" tag appears at ~11 months.
- [x] **Automated test suite** — 17 tests (`npm test`) covering TOTP (passes the official RFC vector), booking windows, calendar files, schedule math. Grows with the Stripe build.

## 🟦 ME — blocked on your items above

- [x] **Stripe build — DONE in test mode (early Sep 2026)** and verified end-to-end on the live site: pay-to-book via Stripe Checkout with 30-min slot holds, cards auto-saved → one-tap rebooking, $50 first-session honored, $1,000/yr membership subscription (card + ACH offered) activating instantly, automatic refunds on customer and staff cancellations.
  - [ ] Warren: add the webhook — Stripe dashboard → Developers → Webhooks → Add endpoint → URL `https://480baseballco-homescoutt.vercel.app/api/stripe/webhook` → events: `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.deleted` → copy the `whsec_…` signing secret → Vercel env var `STRIPE_WEBHOOK_SECRET` → redeploy.
  - [ ] At launch (needs EIN + bank): complete Stripe activation, swap test keys for live keys in Vercel, re-run the dress rehearsal with a real card.
- [ ] **Email** (needs domain + free Resend account): booking confirmations, cancellations, password reset, day-before reminders.
- [ ] **Domain wiring** (needs domain): 480hitting.co → the site, redirects from the vercel.app URL.

## 🏁 Launch gate (together, last week before opening)

- [ ] Swap draft legal pages for lawyer-approved text
- [ ] **Vercel Pro upgrade ($20/mo)** — required for commercial use
- [ ] Purge test accounts (livetest@480check.com) from the live database
- [ ] Full dress rehearsal: real signup by phone → staff creates account → member books → pays with a real card → cancels → refund lands — all on a phone
- [ ] **GO LIVE** — announce the $50 first session

## Post-launch backlog (build when usage asks for it)

SMS reminders · waitlist for freed prime slots · revenue dashboard vs $16.7k/mo break-even · prepaid session packs / heavy-user tier · off-peak member rates · staff settings screen (hours/prices without code) · Stripe Connect platform play (selling the system to other facilities)

---

**Critical path in one line:** bank → Stripe → payments build → dress rehearsal → live.
**Everything else can overlap.** Running cost at launch: ~$23/month + Stripe's ~3% of transactions.
