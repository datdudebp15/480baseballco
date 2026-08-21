import crypto from "crypto";

// RFC 6238 TOTP (the standard used by Google Authenticator, Authy, Apple
// Passwords, etc.). 6 digits, 30-second window, SHA-1 per the RFC.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(): string {
  const buf = crypto.randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function totpCode(
  secret: string,
  timeStep = Math.floor(Date.now() / 30000)
): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(timeStep));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const code =
    (((h[offset] & 0x7f) << 24) |
      (h[offset + 1] << 16) |
      (h[offset + 2] << 8) |
      h[offset + 3]) %
    1000000;
  return String(code).padStart(6, "0");
}

// Accept the previous/current/next 30s window to absorb clock drift.
export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const step = Math.floor(Date.now() / 30000);
  return [step - 1, step, step + 1].some((s) => totpCode(secret, s) === clean);
}

export function otpauthUrl(email: string, secret: string): string {
  const issuer = encodeURIComponent("480 Hitting Co.");
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}`;
}
