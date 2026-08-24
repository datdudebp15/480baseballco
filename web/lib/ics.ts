import { facility } from "./config";

// Build an iCalendar (.ics) file for one booked session, so a confirmation
// can drop straight into Apple/Google/Outlook calendars — no email needed.
// Arizona never observes DST, so Phoenix time is a fixed UTC-7 and events
// can be written in UTC safely.

function utcStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`
  );
}

export function icsForBooking(dateKey: string, hour: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, hour + 7)); // Phoenix -> UTC
  const end = new Date(start.getTime() + 3600 * 1000);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//480 Hitting Co.//Reservations//EN",
    "BEGIN:VEVENT",
    `UID:480-${dateKey}-${hour}@480hitting`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:Hitting Session — ${facility.name}`,
    `LOCATION:${facility.name}\\, ${facility.location}`,
    "DESCRIPTION:One-hour session in the lane. Cancellations must be made " +
      "more than 24 hours before the start time.",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Hitting session at 480 in 2 hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(dateKey: string, hour: number): void {
  const blob = new Blob([icsForBooking(dateKey, hour)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `480-session-${dateKey}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
