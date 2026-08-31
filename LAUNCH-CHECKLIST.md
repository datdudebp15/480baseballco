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

## 🟨 ME — unblocked (next work block, say go)

- [ ] **Security batch:** Next.js 16 upgrade (clears remaining advisories), rate-limit the 2FA endpoint, origin checks, staff audit log.
- [ ] **Database backup export** (staff button) — insurance until the $19/mo Neon tier with point-in-time recovery.
- [ ] **Member-since / renewal tracking** — so annual memberships don't silently lapse before Stripe subscriptions exist.
- [ ] **Automated test suite** — do right before the Stripe build touches real money.

## 🟦 ME — blocked on your items above

- [ ] **Stripe build** (needs your Stripe account): pay-to-book with saved cards, membership subscriptions (+ ACH option), automatic refunds, webhooks. ~1 week of sessions. **This is "fully functional."**
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
