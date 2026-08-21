// Launch-day cleanup: removes the seeded demo accounts and everything tied
// to them (bookings, friendships, sessions cascade via foreign keys).
// The admin account is kept. Usage: node scripts/purge-demo.js
const path = require("path");
const Database = require("better-sqlite3");

const DEMO_EMAILS = [
  "danny@demo.com",
  "mike@demo.com",
  "sara@demo.com",
  "jake@demo.com",
];

const db = new Database(path.join(__dirname, "..", "data", "app.db"));
db.pragma("foreign_keys = ON");

let removed = 0;
for (const email of DEMO_EMAILS) {
  removed += db.prepare("DELETE FROM users WHERE email = ?").run(email).changes;
  db.prepare("DELETE FROM login_attempts WHERE email = ?").run(email);
}
console.log(`Removed ${removed} demo accounts (and their bookings/friendships).`);
console.log("Remember to change the admin password before going live.");
