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

function eventBlock(dateKey: string, startHour: number, runLength: number): string[] {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, startHour + 7)); // Phoenix -> UTC
  // Sessions are 50 minutes with a 10-minute lane reset; consecutive hours
  // run continuously and end 50 minutes into the final hour.
  const end = new Date(
    start.getTime() + ((runLength - 1) * 60 + facility.sessionMinutes) * 60 * 1000
  );
  return [
    "BEGIN:VEVENT",
    `UID:480-${dateKey}-${startHour}@480hitting`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:Hitting Session — ${facility.name}`,
    `LOCATION:${facility.name}\\, ${facility.location}`,
    "DESCRIPTION:Session in the lane. Cancellations must be made more than " +
      "24 hours before the start time.",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Hitting session at 480 in 2 hours",
    "END:VALARM",
    "END:VEVENT",
  ];
}

// One calendar file for any set of same-day hours: consecutive hours merge
// into a single continuous event, gaps become separate events.
export function icsForBookings(dateKey: string, hours: number[]): string {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const events: string[] = [];
  let runStart = sorted[0];
  let runLen = 1;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) {
      runLen++;
    } else {
      events.push(...eventBlock(dateKey, runStart, runLen));
      if (i < sorted.length) {
        runStart = sorted[i];
        runLen = 1;
      }
    }
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//480 Hitting Co.//Reservations//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function icsForBooking(dateKey: string, hour: number, hours = 1): string {
  return icsForBookings(
    dateKey,
    Array.from({ length: hours }, (_, i) => hour + i)
  );
}

export function downloadIcsSet(dateKey: string, hours: number[]): void {
  const blob = new Blob([icsForBookings(dateKey, hours)], {
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

export function downloadIcs(dateKey: string, hour: number, hours = 1): void {
  const blob = new Blob([icsForBooking(dateKey, hour, hours)], {
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
