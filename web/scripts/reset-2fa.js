// Staff utility: turn off 2FA for an account (e.g., customer lost their phone).
// Usage: node scripts/reset-2fa.js someone@email.com
const path = require("path");
const Database = require("better-sqlite3");

const email = (process.argv[2] || "").toLowerCase();
if (!email) {
  console.error("Usage: node scripts/reset-2fa.js <email>");
  process.exit(1);
}

const db = new Database(path.join(__dirname, "..", "data", "app.db"));
const result = db
  .prepare(
    "UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE email = ?"
  )
  .run(email);
console.log(
  result.changes ? `2FA cleared for ${email}` : `No account found for ${email}`
);
