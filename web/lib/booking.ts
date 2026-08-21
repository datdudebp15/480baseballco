import { facility } from "./config";
import type { SessionUser } from "./auth";

// "Danny Howitz" -> "Danny H." for schedule display.
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0]}.`
    : parts[0];
}

export function isValidDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

// Whole days between today (local) and the given date key.
export function daysOut(dateKey: string, now: Date): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

export function slotStart(dateKey: string, hour: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

// Server-side gate for every booking attempt. Returns an error message or
// null when the slot is bookable for this user.
export function bookingWindowError(
  user: SessionUser,
  dateKey: string,
  hour: number,
  now: Date
): string | null {
  if (!isValidDateKey(dateKey) || !Number.isInteger(hour)) {
    return "Invalid slot.";
  }
  if (hour < facility.openHour || hour >= facility.closeHour) {
    return "That hour is outside our operating hours.";
  }
  const out = daysOut(dateKey, now);
  if (out < 0 || slotStart(dateKey, hour) <= now) {
    return "That time has already passed.";
  }
  const maxDays = user.isMember
    ? facility.memberWindowDays
    : facility.publicWindowDays;
  if (out > maxDays) {
    return user.isMember
      ? `Bookings open ${facility.memberWindowDays} days in advance.`
      : `Public booking opens ${facility.publicWindowDays} days before each date — members can book this now.`;
  }
  return null;
}

export function rateFor(user: SessionUser): number {
  return user.isMember ? facility.memberHourlyRate : facility.publicHourlyRate;
}
