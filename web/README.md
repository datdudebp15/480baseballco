# 480 Hitting Co. — Reservations

Booking app for the hitting facility. See [../PRD.md](../PRD.md) for the full product spec.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:3017.

## Current state

Real accounts, real bookings, SQLite database (`data/app.db`, created and
seeded on first run).

- **/** — landing page
- **/book** — live 21-day schedule. Booking requires login; member/public
  windows (21 vs 7 days) and the 3-per-hour capacity are enforced
  server-side. Members see who's booked (Member/Guest tags); everyone sees
  their friends on the schedule.
- **/signup, /login, /account** — accounts, upcoming bookings with
  cancellation (>24h), friends list (add by email, accept/decline), payment
  method stub (Stripe later; cards never stored locally)
- **/membership** — membership pitch; front desk (admin) activates
- **/admin** — staff-only: stats, today-at-a-glance, live occupancy, account
  list; click a name to manage that account (bookings, membership, temp
  password, 2FA reset)
- **/admin/blocks** — team blocks: one-off or recurring patterns, 30-day
  rule with override, never displaces existing bookings
- **/waiver, /terms, /privacy** — DRAFT legal pages; waiver acceptance is
  required (and recorded) at signup

Also wired in: $50 first-session rate for new guest accounts (automatic),
login rate-limiting (5 fails = 15-min lock), password change (Account →
Security), Arizona-pinned business clock (`lib/time.ts`), secure cookies in
production. `scripts/purge-demo.js` wipes demo accounts at launch;
`scripts/reset-2fa.js <email>` clears a lost 2FA.

Business numbers (hours, rates, windows, capacity) live in `lib/config.ts`.

## Demo accounts (seeded on first run)

| Email | Password | Role |
| --- | --- | --- |
| admin@480hitting.co | admin480! | Staff/admin (member) |
| danny@demo.com | demo1234 | Member |
| mike@demo.com | demo1234 | Member (friends with Danny) |
| sara@demo.com | demo1234 | Guest (pending request to Danny) |
| jake@demo.com | demo1234 | Guest |

Delete `data/app.db` to reset and reseed.

## Next phases (per PRD)

1. Stripe: hourly checkout, saved cards (Stripe customer vault), $1,000
   membership subscription
2. Email confirmations and reminders
3. Team blocks (30+ days out) and pricing controls in admin
4. Swap SQLite → Postgres for launch
