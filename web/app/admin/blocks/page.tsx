"use client";

import { useCallback, useEffect, useState } from "react";
import { facility } from "@/lib/config";
import { dateFromKey, formatDayLong, formatHour, localKey } from "@/lib/schedule";

type BlockRow = {
  id: number;
  batchId: string;
  teamName: string;
  date: string;
  hour: number;
  units: number;
  note: string | null;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminBlocksPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [me, setMe] = useState<any | undefined>(undefined);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [teamName, setTeamName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [hours, setHours] = useState<number[]>([]);
  const [units, setUnits] = useState(facility.capacityPerHour);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [pendingOverride, setPendingOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/me").then((r) => r.json());
    setMe(meRes.user);
    if (!meRes.user || meRes.user.role !== "admin") return;
    const b = await fetch("/api/admin/blocks").then((r) => r.json());
    setBlocks(b.blocks ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allHours = Array.from(
    { length: facility.closeHour - facility.openHour },
    (_, i) => facility.openHour + i
  );

  function toggle(list: number[], value: number, set: (v: number[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function submit(e: React.FormEvent | null, override = false) {
    e?.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamName,
        startDate,
        endDate: endDate || startDate,
        daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined,
        hours,
        units,
        note,
        override,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.needsOverride) {
      setPendingOverride(data.error);
      return;
    }
    setPendingOverride(null);
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    const skippedNote =
      data.skipped.length > 0
        ? ` ${data.skipped.length} slot${data.skipped.length === 1 ? "" : "s"} skipped (not enough open spots — existing bookings are never removed).`
        : "";
    setNotice({
      kind: "success",
      text: `Blocked ${data.created} slot${data.created === 1 ? "" : "s"} for ${teamName}.${skippedNote}`,
    });
    load();
  }

  async function removeBatch(batchId: string, team: string) {
    const res = await fetch(`/api/admin/blocks?batch=${batchId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setNotice(
      res.ok
        ? { kind: "success", text: `Removed ${data.removed} upcoming slots for ${team}.` }
        : { kind: "error", text: data.error }
    );
    load();
  }

  if (me === undefined) return <p className="loading">Loading…</p>;
  if (!me || me.role !== "admin") {
    return (
      <div className="notice info">
        Staff access only. <a href="/login?next=/admin/blocks">Log in</a> with a
        staff account.
      </div>
    );
  }

  // Group rows by batch for a readable list.
  const batches = new Map<string, BlockRow[]>();
  for (const b of blocks) {
    if (!batches.has(b.batchId)) batches.set(b.batchId, []);
    batches.get(b.batchId)!.push(b);
  }

  return (
    <>
      <p style={{ marginBottom: 10 }}>
        <a href="/admin">← Staff Dashboard</a>
      </p>
      <h1 className="page-title">Team Blocks</h1>
      <p className="page-sub">
        Sell team time (negotiated offline) and pull it off the public
        schedule. Team blocks are normally placed at least{" "}
        {facility.teamWindowMinDays} days out — before members can book — and
        never remove existing bookings.
      </p>

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      <form onSubmit={(e) => submit(e)} className="card block">
        <h3 style={{ marginBottom: 12 }}>New Block</h3>
        <label className="field">
          Team name
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="ASU Baseball" required />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, minWidth: 150 }}>
            Start date
            <input type="date" value={startDate} min={localKey(new Date())} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 150 }}>
            End date (optional, for recurring)
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <div className="field">
          Days of week (leave empty for every day in range)
          <div className="pick-row">
            {DOW.map((d, i) => (
              <button
                type="button"
                key={d}
                className={`pick${daysOfWeek.includes(i) ? " on" : ""}`}
                onClick={() => toggle(daysOfWeek, i, setDaysOfWeek)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          Hours
          <div className="pick-row">
            {allHours.map((h) => (
              <button
                type="button"
                key={h}
                className={`pick${hours.includes(h) ? " on" : ""}`}
                onClick={() => toggle(hours, h, setHours)}
              >
                {formatHour(h)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, minWidth: 150 }}>
            Spots per hour (of {facility.capacityPerHour})
            <select value={units} onChange={(e) => setUnits(Number(e.target.value))}>
              {[1, 2, 3].slice(0, facility.capacityPerHour).map((u) => (
                <option key={u} value={u}>
                  {u === facility.capacityPerHour ? `${u} — whole lane` : u}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: 2, minWidth: 200 }}>
            Note (rate, contact, invoice #…)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="$250/hr · coach Smith · net 30" />
          </label>
        </div>

        {pendingOverride ? (
          <div className="notice info">
            {pendingOverride}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn small" disabled={busy} onClick={() => submit(null, true)}>
                Yes, Place Inside 30 Days
              </button>{" "}
              <button type="button" className="link-btn" onClick={() => setPendingOverride(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn" disabled={busy || hours.length === 0}>
            {busy ? "Placing…" : "Place Block"}
          </button>
        )}
      </form>

      <h2 className="page-title" style={{ fontSize: 20 }}>
        Upcoming Blocks
      </h2>
      {batches.size === 0 ? (
        <p className="page-sub">No team blocks on the calendar.</p>
      ) : (
        [...batches.entries()].map(([batchId, rows]) => {
          const first = rows[0];
          const dates = [...new Set(rows.map((r) => r.date))];
          const hrs = [...new Set(rows.map((r) => r.hour))].sort((a, b) => a - b);
          return (
            <div key={batchId} className="card block">
              <div className="row" style={{ borderBottom: "none", padding: 0 }}>
                <div>
                  <h3>
                    {first.teamName}{" "}
                    <span className="tag member">
                      {rows.length} slot{rows.length === 1 ? "" : "s"} · {first.units}/hr
                    </span>
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--muted)" }}>
                    {dates.length === 1
                      ? formatDayLong(dateFromKey(dates[0]))
                      : `${formatDayLong(dateFromKey(dates[0]))} → ${formatDayLong(dateFromKey(dates[dates.length - 1]))} (${dates.length} days)`}
                    {" · "}
                    {hrs.map(formatHour).join(", ")}
                    {first.note ? ` · ${first.note}` : ""}
                  </p>
                </div>
                <button className="link-btn" onClick={() => removeBatch(batchId, first.teamName)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
