import { test } from "node:test";
import assert from "node:assert/strict";
import { icsForBooking } from "../lib/ics";

test("converts Phoenix time to UTC (fixed -7)", () => {
  const ics = icsForBooking("2026-09-10", 9); // 9am MST = 16:00Z
  assert.match(ics, /DTSTART:20260910T160000Z/);
  assert.match(ics, /DTEND:20260910T170000Z/);
});

test("late slots roll over to the next UTC day", () => {
  const ics = icsForBooking("2026-09-10", 21); // 9pm MST = 04:00Z next day
  assert.match(ics, /DTSTART:20260911T040000Z/);
});

test("has the essentials calendar apps require", () => {
  const ics = icsForBooking("2026-09-10", 17);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:Hitting Session/);
  assert.match(ics, /BEGIN:VALARM/); // 2-hour reminder
  assert.ok(ics.includes("\r\n"), "uses CRLF line endings per RFC 5545");
  assert.match(ics, /END:VCALENDAR$/);
});
