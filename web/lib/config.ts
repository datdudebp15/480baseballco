// Facility settings — every business number lives here so it can move to an
// admin-editable database table later without touching UI code.
export const facility = {
  name: "480 Hitting Co.",
  location: "Mesa, AZ",

  // Membership is set up personally — accounts are created by staff after a
  // conversation, not self-serve.
  ownerName: "Warren Holzemer",
  phoneDisplay: "(703) 755-5977",
  phoneTel: "+17037555977",

  // Operating hours (24h clock). Last bookable slot starts one hour before close.
  openHour: 8,
  closeHour: 22,

  // Spots available per one-hour slot.
  capacityPerHour: 3,

  // Booking windows (days before a date that booking opens).
  memberWindowDays: 21,
  publicWindowDays: 7,
  teamWindowMinDays: 30, // team blocks must be placed at least this far out

  // Rates (validated against the Phoenix market — Driveline parity at $100).
  memberHourlyRate: 75,
  publicHourlyRate: 100,
  // One-time intro rate for a brand-new account's first booking.
  firstSessionRate: 50,
  subscriptionPrice: 1000,
};

// Prime time: weekday evenings and most of the weekend.
export function isPrimeHour(date: Date, hour: number): boolean {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const weekend = day === 0 || day === 6;
  return weekend ? hour >= 9 && hour < 21 : hour >= 16 && hour < 21;
}
