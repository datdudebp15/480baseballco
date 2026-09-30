# 480 Hitting Co. — Ready-to-Deploy Checklist

The operational pre-flight: run top to bottom the week you go live with real
money. (Strategy & build status live in LAUNCH-CHECKLIST.md.)

Live site: https://480baseballco-homescoutt.vercel.app · Repo: github.com/datdudebp15/480baseballco

---

## 1 · Security (do these NOW, not launch week)

- [ ] **2FA on the staff account** — log into the site → Account → Security → Enable 2FA (scan QR)
- [ ] **2FA on Vercel** — vercel.com → Account Settings → Authentication
- [ ] **2FA on GitHub** — github.com → Settings → Password and authentication
- [ ] **2FA on Stripe** — dashboard → Profile → Security (do at account creation if not already)
- [ ] **`STRIPE_WEBHOOK_SECRET` into Vercel** — STILL MISSING as of Sep 30. Stripe dashboard → your webhook destination → Reveal signing secret → Vercel env var (Production checked) → Redeploy. Verify: `/api/health` must show `webhookSecret: true`.
- [x] Hardened HTTP headers (CSP, anti-clickjacking, HSTS, nosniff) — shipped Sep 30
- [x] In-app: bcrypt passwords, revocable sessions, login + 2FA rate limits, origin checks, staff audit log, role-gated APIs, no public signup

## 2 · Stripe: test → live (needs EIN + business bank)

- [ ] Complete Stripe **activation** (EIN, business address, bank for payouts)
- [ ] Dashboard → switch OFF Test mode → **Developers → API keys** → copy the LIVE pair
- [ ] Vercel env: replace `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` with the live values
- [ ] Recreate the **webhook destination in live mode** (same 5 events, same URL) → put its new `whsec_…` into `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy → `/api/health` green, then check the membership price auto-creates on first live checkout

## 3 · Domain & email (needs the domain purchase)

- [ ] Buy 480hitting.co → Vercel project → Settings → Domains → add it (site + booking live on one domain already)
- [ ] Free Resend account → verify the domain (2 DNS records) → `RESEND_API_KEY` to Vercel → tell Claude: email build (confirmations, password reset) is ~1 session
- [ ] Update Stripe webhook URL + any printed links to the new domain

## 4 · Content & legal

- [ ] Swap DRAFT text on /waiver, /terms, /privacy for lawyer-approved versions
- [ ] Facility photos → replace "Photos coming soon" tiles (hand files to Claude)
- [ ] Voicemail on (703) 755-5977 mentions 480 Hitting Co. (or port to a 480 number)

## 5 · Data hygiene (launch week)

- [ ] Delete test accounts from the live DB via staff dashboard: `livetest@480check.com` (+ your gmail guest account if unwanted)
- [ ] Confirm the only staff account is yours, with 2FA on
- [ ] Download a backup (staff dashboard → Download backup) — first of a weekly habit
- [ ] Consider Neon paid tier ($19/mo) for point-in-time restore once real revenue exists

## 6 · Platform

- [ ] **Vercel Pro upgrade ($20/mo)** — required for commercial use, do before first real charge
- [ ] Uptime monitor (free UptimeRobot) pinging `https://<domain>/api/health` → alerts to your phone

## 7 · Dress rehearsal (the final gate — real card, on a phone)

- [ ] Create a fresh customer account via the staff Add Account form
- [ ] Log in as them on a phone → book a slot → pay with a REAL card → confirm charge in Stripe
- [ ] Confirm the card saved → book again → one-tap charge works
- [ ] Cancel a >24h booking → refund appears in Stripe
- [ ] Buy a membership with a real card (you can refund/cancel it after) → member badge + 21-day window
- [ ] Check the webhook destination's Event deliveries: all green 200s
- [ ] Add to Home Screen on your iPhone — app icon opens straight to the schedule

## 8 · Go

- [ ] Text the link to the first real members
- [ ] Announce the $50 first session
- [ ] Watch the staff dashboard's Recent Activity + Stripe payments for the first week

---
**Sequence:** §1 today · §2–3 as paperwork lands · §4–6 any time · §7 last · §8 🎉
