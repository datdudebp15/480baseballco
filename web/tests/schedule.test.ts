import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateFromKey,
  formatHour,
  getBookableDays,
  localKey,
} from "../lib/schedule";
import { facility, isPrimeHour } from "../lib/config";

const NOW = new Date(2026, 8, 10, 12, 0); // Thu Sep 10, 2026

test("calendar spans exactly the member window", () => {
  const days = getBookableDays(NOW);
  assert.equal(days.length, facility.memberWindowDays);
  assert.equal(days[0].key, "2026-09-10");
  assert.equal(days[20].key, "2026-09-30");
});

test("members-only flag flips right after the public window", () => {
  const days = getBookableDays(NOW);
  assert.equal(days[facility.publicWindowDays].membersOnly, false); // day 7: public
  assert.equal(days[facility.publicWindowDays + 1].membersOnly, true); // day 8: members
});

test("date keys round-trip", () => {
  const d = dateFromKey("2026-12-05");
  assert.equal(localKey(d), "2026-12-05");
  assert.equal(d.getMonth(), 11);
});

test("hour formatting", () => {
  assert.equal(formatHour(8), "8:00 AM");
  assert.equal(formatHour(12), "12:00 PM");
  assert.equal(formatHour(21), "9:00 PM");
});

test("prime hours: weekday evenings, weekend days", () => {
  const thursday = new Date(2026, 8, 10);
  const saturday = new Date(2026, 8, 12);
  assert.equal(isPrimeHour(thursday, 10), false);
  assert.equal(isPrimeHour(thursday, 17), true);
  assert.equal(isPrimeHour(saturday, 10), true);
  assert.equal(isPrimeHour(saturday, 8), false);
});
