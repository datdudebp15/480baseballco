import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSecret, totpCode, verifyTotp } from "../lib/totp";

// RFC 6238 test vector: ASCII secret "12345678901234567890" (base32 below),
// T = 59s -> time step 1 -> SHA-1 8-digit code 94287082 -> 6-digit 287082.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("matches the RFC 6238 known-answer vector", () => {
  assert.equal(totpCode(RFC_SECRET, 1), "287082");
});

test("generated secrets are 32-char base32", () => {
  const s = generateSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.notEqual(generateSecret(), s);
});

test("verifies the current code and the adjacent window", () => {
  const secret = generateSecret();
  const step = Math.floor(Date.now() / 30000);
  assert.equal(verifyTotp(secret, totpCode(secret, step)), true);
  assert.equal(verifyTotp(secret, totpCode(secret, step - 1)), true);
  assert.equal(verifyTotp(secret, totpCode(secret, step + 1)), true);
});

test("rejects wrong, stale, and malformed codes", () => {
  const secret = generateSecret();
  const step = Math.floor(Date.now() / 30000);
  assert.equal(verifyTotp(secret, totpCode(secret, step - 5)), false);
  assert.equal(verifyTotp(secret, "000000") && verifyTotp(secret, "999999"), false);
  assert.equal(verifyTotp(secret, "12345"), false);
  assert.equal(verifyTotp(secret, "abcdef"), false);
});
