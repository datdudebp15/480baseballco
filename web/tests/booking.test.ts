import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookingWindowError,
  daysOut,
  isValidDateKey,
  rateFor,
  shortName,
  slotStart,
} from "../lib/booking";
import { facility } from "../lib/config";
import type { SessionUser } from "../lib/auth";

const NOW = new Date(2026, 8, 10, 12, 0); // Sep 10, 2026, noon

const member: SessionUser = {
  id: 1, email: "m@x.com", name: "Member Person", phone: null,
  role: "user", isMember: true, twoFactorEnabled: false,
};
const guest: SessionUser = { ...member, id: 2, isMember: false };

test("daysOut counts whole local days", () => {
  assert.equal(daysOut("2026-09-10", NOW), 0);
  assert.equal(daysOut("2026-09-11", NOW), 1);
  assert.equal(daysOut("2026-09-09", NOW), -1);
  assert.equal(daysOut("2026-10-01", NOW), 21);
});

test("members book out to 21 days, guests to 7", () => {
  assert.equal(bookingWindowError(member, "2026-09-30", 15, NOW), null); // 20 out
  assert.equal(bookingWindowError(guest, "2026-09-17", 15, NOW), null); // 7 out
  assert.match(bookingWindowError(guest, "2026-09-18", 15, NOW) ?? "", /members/i); // 8 out
  assert.match(bookingWindowError(member, "2026-10-02", 15, NOW) ?? "", /advance/i); // 22 out
});

test("past slots and bad hours are rejected", () => {
  assert.match(bookingWindowError(member, "2026-09-10", 11, NOW) ?? "", /passed/i);
  assert.match(bookingWindowError(member, "2026-09-09", 15, NOW) ?? "", /passed/i);
  assert.match(
    bookingWindowError(member, "2026-09-12", facility.closeHour, NOW) ?? "",
    /operating hours/i
  );
  assert.match(bookingWindowError(member, "not-a-date", 15, NOW) ?? "", /invalid/i);
});

test("slot start and date-key validation", () => {
  const s = slotStart("2026-09-10", 17);
  assert.equal(s.getHours(), 17);
  assert.equal(s.getDate(), 10);
  assert.equal(isValidDateKey("2026-09-10"), true);
  assert.equal(isValidDateKey("9/10/2026"), false);
});

test("rates and display names", () => {
  assert.equal(rateFor(member), facility.memberHourlyRate);
  assert.equal(rateFor(guest), facility.publicHourlyRate);
  assert.equal(shortName("Danny Howitz"), "Danny H.");
  assert.equal(shortName("Cher"), "Cher");
});
