import crypto from "crypto";
import { NextResponse } from "next/server";
import { audit, getDb, slotUsage, type Dbx } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { facility } from "@/lib/config";
import { addDays, localKey } from "@/lib/schedule";
import { daysOut, isValidDateKey, slotStart } from "@/lib/booking";
import { phoenixNow } from "@/lib/time";

async function requireAdmin() {
  const user = await getUser();
  return user && user.role === "admin" ? user : null;
}

// Staff-only: all current/upcoming team blocks.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const today = localKey(phoenixNow());
  const db = await getDb();
  const blocks = await db.all(
    `SELECT id, batch_id AS "batchId", team_name AS "teamName", date, hour, units, note
     FROM team_blocks WHERE date >= ? ORDER BY date, hour`,
    [today]
  );
  return NextResponse.json({ blocks });
}

// Staff-only: create a block — one date or a recurring pattern.
// Body: { teamName, startDate, endDate?, daysOfWeek?: number[] (0=Sun),
//         hours: number[], units?: 1-3, note?, override?: boolean }
// Rules: team time is placed >= 30 days out (override with confirmation);
// a block only consumes units still open — it never displaces bookings.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const teamName = (body?.teamName ?? "").trim();
  const startDate: string = body?.startDate ?? "";
  const endDate: string = body?.endDate || startDate;
  const daysOfWeek: number[] = Array.isArray(body?.daysOfWeek)
    ? body.daysOfWeek.map(Number)
    : [0, 1, 2, 3, 4, 5, 6];
  const hours: number[] = Array.isArray(body?.hours) ? body.hours.map(Number) : [];
  const units = Math.min(
    Math.max(Number(body?.units) || facility.capacityPerHour, 1),
    facility.capacityPerHour
  );
  const note = (body?.note ?? "").trim() || null;
  const override = !!body?.override;

  if (teamName.length < 2) {
    return NextResponse.json({ error: "Enter a team name." }, { status: 400 });
  }
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || endDate < startDate) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }
  if (
    hours.length === 0 ||
    hours.some(
      (h) => !Number.isInteger(h) || h < facility.openHour || h >= facility.closeHour
    )
  ) {
    return NextResponse.json({ error: "Pick at least one valid hour." }, { status: 400 });
  }

  const now = phoenixNow();

  // Expand the pattern into concrete (date, hour) slots.
  const candidates: { date: string; hour: number }[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  let cursor = new Date(sy, sm - 1, sd);
  let guard = 0;
  while (localKey(cursor) <= endDate && guard < 185) {
    if (daysOfWeek.includes(cursor.getDay())) {
      const key = localKey(cursor);
      for (const hour of hours) {
        if (slotStart(key, hour) > now) candidates.push({ date: key, hour });
      }
    }
    cursor = addDays(cursor, 1);
    guard++;
  }
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "That pattern contains no future slots." },
      { status: 400 }
    );
  }

  const insideWindow = candidates.filter(
    (c) => daysOut(c.date, now) < facility.teamWindowMinDays
  );
  if (insideWindow.length > 0 && !override) {
    return NextResponse.json(
      {
        needsOverride: true,
        error: `${insideWindow.length} of these slots are inside the ${facility.teamWindowMinDays}-day team window (team time is normally sold a month out, before members book). Confirm to place them anyway — existing bookings are never removed.`,
      },
      { status: 409 }
    );
  }

  const db = await getDb();
  const batchId = crypto.randomUUID();
  const skipped: { date: string; hour: number; open: number }[] = [];
  let created = 0;

  await db.tx(async (t: Dbx) => {
    for (const c of candidates) {
      await t.lockSlot(c.date, c.hour);
      const open = facility.capacityPerHour - (await slotUsage(t, c.date, c.hour)).used;
      if (open < units) {
        skipped.push({ ...c, open });
        continue;
      }
      await t.run(
        `INSERT INTO team_blocks (batch_id, team_name, date, hour, units, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [batchId, teamName, c.date, c.hour, units, note]
      );
      created++;
    }
  });

  await audit(
    db,
    admin.email,
    "block.create",
    `${teamName}: ${created} slots (${startDate}..${endDate}, units ${units})`
  );
  return NextResponse.json({ batchId, created, skipped });
}

// Staff-only: remove a single block row (?id=) or a whole batch's future
// rows (?batch=).
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const batch = url.searchParams.get("batch");
  const db = await getDb();

  let changes = 0;
  if (id) {
    changes = await db.run("DELETE FROM team_blocks WHERE id = ?", [Number(id)]);
  } else if (batch) {
    const today = localKey(phoenixNow());
    changes = await db.run(
      "DELETE FROM team_blocks WHERE batch_id = ? AND date >= ?",
      [batch, today]
    );
  }
  if (changes === 0) {
    return NextResponse.json({ error: "Block not found." }, { status: 404 });
  }
  await audit(db, admin.email, "block.remove", id ? `block row #${id}` : `batch ${batch} (${changes} rows)`);
  return NextResponse.json({ removed: changes });
}
