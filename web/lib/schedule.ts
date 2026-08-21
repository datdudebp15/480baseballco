import { facility } from "./config";

export type DayInfo = {
  date: Date;
  key: string; // YYYY-MM-DD (local)
  daysOut: number;
  membersOnly: boolean; // beyond the public window — subscribers only
};

export function localKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// The full member-visible calendar: today through 21 days out.
export function getBookableDays(now: Date): DayInfo[] {
  const days: DayInfo[] = [];
  for (let i = 0; i < facility.memberWindowDays; i++) {
    const date = addDays(now, i);
    days.push({
      date,
      key: localKey(date),
      daysOut: i,
      membersOnly: i > facility.publicWindowDays,
    });
  }
  return days;
}

export function formatHour(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  return `${h}:00 ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatDayShort(d: Date): { weekday: string; day: number } {
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    day: d.getDate(),
  };
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
