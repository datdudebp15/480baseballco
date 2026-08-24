"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dateFromKey,
  formatDayShort,
  formatHour,
} from "@/lib/schedule";

type RosterEntry = { name: string; member: boolean; team?: boolean };
type Slot = { hour: number; past: boolean; count: number; roster?: RosterEntry[] };
type Stats = {
  bookingsToday: number;
  bookings7d: number;
  revenue7d: number;
  members: number;
};
type SlotDetail = {
  date: string;
  hour: number;
  bookings: { id: number; userId: number; name: string; email: string; isMember: number; price: number }[];
  blocks: { id: number; teamName: string; units: number; note: string | null }[];
  open: number;
  capacity: number;
};
type UserRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isMember: number;
  upcoming: number;
};

const DAYS_SHOWN = 7;

export default function AdminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [me, setMe] = useState<any | undefined>(undefined);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [na, setNa] = useState({ name: "", email: "", phone: "", tempPassword: "", isMember: true, waiverSigned: false });
  const [slotDetail, setSlotDetail] = useState<SlotDetail | null>(null);
  const [days, setDays] = useState<{ key: string }[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [capacity, setCapacity] = useState(3);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/me").then((r) => r.json());
    setMe(meRes.user);
    if (!meRes.user || meRes.user.role !== "admin") return;
    const [u, s] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/schedule").then((r) => r.json()),
    ]);
    setUsers(u.users ?? []);
    setStats(u.stats ?? null);
    setDays(s.days.slice(0, DAYS_SHOWN));
    setSlots(s.slots);
    setCapacity(s.capacity);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openSlot(date: string, hour: number) {
    const res = await fetch(`/api/admin/slot?date=${date}&hour=${hour}`);
    if (res.ok) setSlotDetail(await res.json());
  }

  async function removeBooking(id: number, name: string) {
    const res = await fetch(`/api/admin/bookings?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setNotice(
      res.ok
        ? { kind: "success", text: `Removed ${name} from the slot.` }
        : { kind: "error", text: data.error }
    );
    if (slotDetail) openSlot(slotDetail.date, slotDetail.hour);
    load();
  }

  async function removeBlockHour(id: number, team: string) {
    const res = await fetch(`/api/admin/blocks?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setNotice(
      res.ok
        ? { kind: "success", text: `Removed ${team}'s hold on this hour (the rest of their block is untouched).` }
        : { kind: "error", text: data.error }
    );
    if (slotDetail) openSlot(slotDetail.date, slotDetail.hour);
    load();
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...na }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    setNotice({
      kind: "success",
      text: `Account created for ${na.name} (${na.isMember ? "Member" : "Guest"}). Give them their temp password — they can change it on their Account page.`,
    });
    setNa({ name: "", email: "", phone: "", tempPassword: "", isMember: true, waiverSigned: false });
    load();
  }

  async function toggleMember(u: UserRow) {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, isMember: !u.isMember }),
    });
    load();
  }

  if (me === undefined) {
    return <p className="loading">Loading…</p>;
  }
  if (!me || me.role !== "admin") {
    return (
      <>
        <h1 className="page-title">Staff Dashboard</h1>
        <div className="notice info">
          Staff access only. <a href="/login?next=/admin">Log in</a> with a
          staff account.
        </div>
      </>
    );
  }

  const hours = slots[days[0]?.key]?.map((s) => s.hour) ?? [];
  const todaySlots = (slots[days[0]?.key] ?? []).filter(
    (s) => !s.past && s.count > 0
  );

  return (
    <>
      <h1 className="page-title">Staff Dashboard</h1>
      <p className="page-sub">
        Logged in as {me.name} (staff). Only staff accounts can see this page.
        {" · "}
        <a href="/admin/blocks">Manage team blocks →</a>
      </p>

      {stats && (
        <section className="cards" style={{ marginBottom: 24, marginTop: 0 }}>
          <div className="card">
            <div className="big">{stats.bookingsToday}</div>
            <h3>Bookings Today</h3>
          </div>
          <div className="card">
            <div className="big">{stats.bookings7d}</div>
            <h3>Next 7 Days</h3>
          </div>
          <div className="card">
            <div className="big">${stats.revenue7d.toLocaleString()}</div>
            <h3>7-Day Booked Revenue</h3>
          </div>
          <div className="card">
            <div className="big">{stats.members}</div>
            <h3>Members</h3>
          </div>
        </section>
      )}

      <h2 className="page-title" style={{ fontSize: 20 }}>
        Today at a Glance
      </h2>
      {todaySlots.length === 0 ? (
        <p className="page-sub">No more bookings today.</p>
      ) : (
        <ul className="rows card block" style={{ padding: "8px 20px" }}>
          {todaySlots.map((s) => (
            <li key={s.hour} className="row">
              <strong>{formatHour(s.hour)}</strong>
              <span className="roster">
                {s.roster?.map((p, i) => (
                  <span key={i} className={`chip${p.member ? " member" : ""}`}>
                    {p.name}
                  </span>
                ))}
              </span>
              <span>
                {s.count}/{capacity}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="page-title" style={{ fontSize: 20, marginTop: 24 }}>
        Week Occupancy
      </h2>
      <p className="page-sub">
        Open spots per hour (out of {capacity}). Hover a cell to see
        who&apos;s booked.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Hour</th>
              {days.map((d, i) => {
                const { weekday, day } = formatDayShort(dateFromKey(d.key));
                return <th key={d.key}>{i === 0 ? "Today" : `${weekday} ${day}`}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour, hi) => (
              <tr key={hour}>
                <th>{formatHour(hour)}</th>
                {days.map((d) => {
                  const slot = slots[d.key]?.[hi];
                  if (!slot) return <td key={d.key} />;
                  const open = capacity - slot.count;
                  const names = slot.roster
                    ?.map(
                      (p) =>
                        `${p.name}${p.team ? " (team)" : p.member ? " (M)" : ""}`
                    )
                    .join(", ");
                  return (
                    <td
                      key={d.key}
                      className={`occ-${Math.max(open, 0)} occ-click`}
                      title={names ? `${names} — click to manage` : "Click to manage"}
                      onClick={() => openSlot(d.key, hour)}
                    >
                      {slot.past ? "—" : open}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slotDetail && (
        <div className="card block" style={{ marginTop: 16, borderColor: "var(--red)" }}>
          <div className="row" style={{ borderBottom: "none", padding: 0 }}>
            <h3>
              {formatDayShort(dateFromKey(slotDetail.date)).weekday}{" "}
              {dateFromKey(slotDetail.date).getDate()} · {formatHour(slotDetail.hour)}{" "}
              <span className="tag">
                {slotDetail.open} of {slotDetail.capacity} open
              </span>
            </h3>
            <button className="link-btn muted" onClick={() => setSlotDetail(null)}>
              Close
            </button>
          </div>
          {slotDetail.bookings.length === 0 && slotDetail.blocks.length === 0 ? (
            <p style={{ marginTop: 8 }}>Nobody in this slot.</p>
          ) : (
            <ul className="rows">
              {slotDetail.bookings.map((b) => (
                <li key={`b-${b.id}`} className="row">
                  <span>
                    <a href={`/admin/users/${b.userId}`}>{b.name}</a>{" "}
                    <span className={`tag ${b.isMember ? "member" : ""}`}>
                      {b.isMember ? "Member" : "Guest"}
                    </span>{" "}
                    <small>${b.price}</small>
                  </span>
                  <button className="link-btn" onClick={() => removeBooking(b.id, b.name)}>
                    Remove
                  </button>
                </li>
              ))}
              {slotDetail.blocks.map((bl) => (
                <li key={`t-${bl.id}`} className="row">
                  <span>
                    {bl.teamName} <span className="tag member">Team · {bl.units} spot{bl.units === 1 ? "" : "s"}</span>
                    {bl.note ? <small> {bl.note}</small> : null}
                  </span>
                  <button className="link-btn" onClick={() => removeBlockHour(bl.id, bl.teamName)}>
                    Remove this hour
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <h2 className="page-title" style={{ marginTop: 28, fontSize: 20 }}>
        Accounts
      </h2>
      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      <form onSubmit={createAccount} className="card block">
        <h3 style={{ marginBottom: 10 }}>Add Account</h3>
        <p className="page-sub" style={{ marginBottom: 12 }}>
          New customers reach out to you by phone — create their account here
          after the conversation.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, minWidth: 160 }}>
            Name
            <input value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} required />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 180 }}>
            Email
            <input type="email" value={na.email} onChange={(e) => setNa({ ...na, email: e.target.value })} required />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            Phone (optional)
            <input value={na.phone} onChange={(e) => setNa({ ...na, phone: e.target.value })} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 160 }}>
            Temp password (8+)
            <input value={na.tempPassword} onChange={(e) => setNa({ ...na, tempPassword: e.target.value })} minLength={8} required />
          </label>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={na.isMember} onChange={(e) => setNa({ ...na, isMember: e.target.checked })} style={{ width: 17, height: 17 }} />
            Member ($1,000 paid)
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={na.waiverSigned} onChange={(e) => setNa({ ...na, waiverSigned: e.target.checked })} style={{ width: 17, height: 17 }} />
            Waiver signed
          </label>
          <button className="btn small">Create Account</button>
        </div>
      </form>

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table left">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Upcoming</th>
              <th>Membership</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <a href={`/admin/users/${u.id}`}>{u.name}</a>
                  {u.role === "admin" ? " (staff)" : ""}
                </td>
                <td>{u.email}</td>
                <td>
                  <span className={`tag ${u.isMember ? "member" : ""}`}>
                    {u.isMember ? "Member" : "Guest"}
                  </span>
                </td>
                <td>{u.upcoming}</td>
                <td>
                  <button className="link-btn" onClick={() => toggleMember(u)}>
                    {u.isMember ? "Remove membership" : "Make member"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page-sub" style={{ marginTop: 10 }}>
        Click a name to view that account&apos;s schedule and move them in or
        out of slots. Membership toggles are the manual path until Stripe
        subscriptions go live.
      </p>
    </>
  );
}
