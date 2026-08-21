import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { facility, isPrimeHour } from "@/lib/config";
import { getBookableDays } from "@/lib/schedule";
import { shortName } from "@/lib/booking";
import { phoenixNow } from "@/lib/time";

type RosterEntry = {
  name: string;
  member: boolean;
  friend: boolean;
  team?: boolean;
};

type SlotOut = {
  hour: number;
  prime: boolean;
  past: boolean;
  count: number; // units used: customer bookings + team-block holds
  mine: number | null;
  roster?: RosterEntry[];
  friends?: string[];
};

export async function GET() {
  const user = await getUser();
  const db = await getDb();
  const now = phoenixNow();
  const days = getBookableDays(now);
  const first = days[0].key;
  const last = days[days.length - 1].key;

  const rows = await db.all(
    `SELECT b.id, b.date, b.hour, b.user_id, u.name, u.is_member
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed' AND b.date BETWEEN ? AND ?`,
    [first, last]
  );

  const blocks = await db.all(
    `SELECT date, hour, units, team_name FROM team_blocks
     WHERE date BETWEEN ? AND ?`,
    [first, last]
  );

  const friendIds = new Set<number>();
  if (user) {
    const fr = await db.all(
      `SELECT requester_id, addressee_id FROM friendships
       WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`,
      [user.id, user.id]
    );
    for (const f of fr) {
      friendIds.add(f.requester_id === user.id ? f.addressee_id : f.requester_id);
    }
  }

  // Roster (who is booked) is member/staff-only. Everyone logged in sees
  // their own friends; logged-out visitors get counts only.
  const canSeeRoster = !!user && (user.isMember || user.role === "admin");

  const slots: Record<string, SlotOut[]> = {};
  for (const day of days) {
    const list: SlotOut[] = [];
    for (let hour = facility.openHour; hour < facility.closeHour; hour++) {
      const start = new Date(day.date);
      start.setHours(hour, 0, 0, 0);
      list.push({
        hour,
        prime: isPrimeHour(day.date, hour),
        past: start <= now,
        count: 0,
        mine: null,
        roster: canSeeRoster ? [] : undefined,
        friends: user ? [] : undefined,
      });
    }
    slots[day.key] = list;
  }

  for (const r of rows) {
    const slot = slots[r.date]?.[r.hour - facility.openHour];
    if (!slot) continue;
    slot.count++;
    if (user && r.user_id === user.id) slot.mine = r.id;
    const isFriend = friendIds.has(r.user_id);
    slot.roster?.push({
      name: shortName(r.name),
      member: !!r.is_member,
      friend: isFriend,
    });
    if (isFriend) slot.friends?.push(shortName(r.name));
  }

  for (const b of blocks) {
    const slot = slots[b.date]?.[b.hour - facility.openHour];
    if (!slot) continue;
    slot.count += Number(b.units);
    slot.roster?.push({
      name: Number(b.units) > 1 ? `${b.team_name} ×${b.units}` : b.team_name,
      member: false,
      friend: false,
      team: true,
    });
  }

  // First booking on a guest account gets the intro rate.
  let firstSessionEligible = false;
  if (user && !user.isMember) {
    const prior = await db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM bookings
       WHERE user_id = ? AND status = 'confirmed'`,
      [user.id]
    );
    firstSessionEligible = Number(prior?.c) === 0;
  }

  return NextResponse.json({
    user,
    capacity: facility.capacityPerHour,
    // Pricing is discussed personally — rates only go to logged-in accounts.
    rates: user
      ? {
          member: facility.memberHourlyRate,
          public: facility.publicHourlyRate,
          firstSession: facility.firstSessionRate,
        }
      : null,
    firstSessionEligible,
    windows: {
      member: facility.memberWindowDays,
      public: facility.publicWindowDays,
    },
    days: days.map((d) => ({
      key: d.key,
      daysOut: d.daysOut,
      membersOnly: d.membersOnly,
    })),
    slots,
  });
}
