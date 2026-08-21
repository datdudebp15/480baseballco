"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  dateFromKey,
  formatDayLong,
  formatDayShort,
  formatHour,
} from "@/lib/schedule";

type RosterEntry = { name: string; member: boolean; team?: boolean };
type Slot = {
  hour: number;
  prime: boolean;
  past: boolean;
  count: number;
  roster?: RosterEntry[];
};
type Day = { key: string; daysOut: number; membersOnly: boolean };
type Booking = { id: number; date: string; hour: number; price: number };

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [me, setMe] = useState<any | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [target, setTarget] = useState<any | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [capacity, setCapacity] = useState(3);
  const [rates, setRates] = useState({ member: 75, public: 100 });
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [busyHour, setBusyHour] = useState<number | null>(null);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/me").then((r) => r.json());
    setMe(meRes.user);
    if (!meRes.user || meRes.user.role !== "admin") return;
    const [s, u] = await Promise.all([
      fetch("/api/schedule").then((r) => r.json()),
      fetch(`/api/admin/bookings?userId=${userId}`).then((r) => r.json()),
    ]);
    setDays(s.days);
    setSlots(s.slots);
    setCapacity(s.capacity);
    setRates(s.rates);
    setTarget(u.user ?? null);
    setBookings(u.bookings ?? []);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (me === undefined) {
    return <p className="loading">Loading…</p>;
  }
  if (!me || me.role !== "admin") {
    return (
      <div className="notice info">
        Staff access only. <a href="/login?next=/admin">Log in</a> with a
        staff account.
      </div>
    );
  }
  if (!target) {
    return <p className="loading">Loading account…</p>;
  }

  // date -> hour -> booking id, for marking this customer's slots
  const bookedMap: Record<string, Record<number, number>> = {};
  for (const b of bookings) {
    (bookedMap[b.date] ??= {})[b.hour] = b.id;
  }

  const day = days[selected];
  const daySlots = slots[day?.key] ?? [];
  const rate = target.isMember ? rates.member : rates.public;

  async function add(hour: number) {
    setBusyHour(hour);
    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date: day.key, hour }),
    });
    const result = await res.json();
    setBusyHour(null);
    setNotice(
      res.ok
        ? {
            kind: "success",
            text: `${target.name} booked: ${formatDayLong(dateFromKey(day.key))} at ${formatHour(hour)} — $${result.price}.`,
          }
        : { kind: "error", text: result.error }
    );
    load();
  }

  async function remove(bookingId: number, label: string) {
    const res = await fetch(`/api/admin/bookings?id=${bookingId}`, {
      method: "DELETE",
    });
    const result = await res.json();
    setNotice(
      res.ok
        ? { kind: "success", text: `Removed ${target.name} from ${label}.` }
        : { kind: "error", text: result.error }
    );
    load();
  }

  async function toggleMember() {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isMember: !target.isMember }),
    });
    load();
  }

  return (
    <>
      <p style={{ marginBottom: 10 }}>
        <a href="/admin">← Staff Dashboard</a>
      </p>
      <section className="card block">
        <h3>
          {target.name}{" "}
          <span className={`tag ${target.isMember ? "member" : ""}`}>
            {target.isMember ? "Member" : "Guest"}
          </span>
        </h3>
        <p>
          {target.email}
          {target.phone ? ` · ${target.phone}` : ""} · pays ${rate}/hr
        </p>
        <button className="link-btn" onClick={toggleMember}>
          {target.isMember ? "Remove membership" : "Make member"}
        </button>
        {" · "}
        <button
          className="link-btn"
          onClick={async () => {
            const temp = window.prompt(
              `Set a temporary password for ${target.name} (8+ characters). They'll be logged out everywhere:`
            );
            if (!temp) return;
            const res = await fetch("/api/admin/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, action: "setPassword", tempPassword: temp }),
            });
            const data = await res.json();
            setNotice(
              res.ok
                ? { kind: "success", text: `Temporary password set for ${target.name}.` }
                : { kind: "error", text: data.error }
            );
          }}
        >
          Set temp password
        </button>
        {" · "}
        <button
          className="link-btn"
          onClick={async () => {
            const res = await fetch("/api/admin/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, action: "reset2fa" }),
            });
            const data = await res.json();
            setNotice(
              res.ok
                ? { kind: "success", text: `2FA cleared for ${target.name}.` }
                : { kind: "error", text: data.error }
            );
          }}
        >
          Reset 2FA
        </button>
      </section>

      <section className="card block">
        <h3>Upcoming Bookings ({bookings.length})</h3>
        {bookings.length === 0 ? (
          <p>None booked.</p>
        ) : (
          <ul className="rows">
            {bookings.map((b) => {
              const label = `${formatDayLong(dateFromKey(b.date))} · ${formatHour(b.hour)}`;
              return (
                <li key={b.id} className="row">
                  <span>
                    {label} · ${b.price}
                  </span>
                  <button className="link-btn" onClick={() => remove(b.id, label)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <h2 className="page-title" style={{ fontSize: 20 }}>
        Schedule — add or remove {target.name.split(" ")[0]}
      </h2>
      <p className="page-sub">
        Staff bookings skip the member/public windows. Days where{" "}
        {target.name.split(" ")[0]} is already booked are marked with a dot.
      </p>

      <div className="day-strip">
        {days.map((d, i) => {
          const dt = dateFromKey(d.key);
          const { weekday, day: num } = formatDayShort(dt);
          const hasBooking = !!bookedMap[d.key];
          return (
            <button
              key={d.key}
              className={`day-chip${i === selected ? " selected" : ""}`}
              onClick={() => {
                setSelected(i);
                setNotice(null);
              }}
            >
              <span className="wd">{i === 0 ? "Today" : weekday}</span>
              <span className="num">{num}</span>
              {hasBooking && <span className="lock">● booked</span>}
            </button>
          );
        })}
      </div>

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      <div className="slot-grid">
        {daySlots.map((slot) => {
          const bookingId = bookedMap[day.key]?.[slot.hour];
          const full = slot.count >= capacity;
          const unavailable = slot.past || (full && !bookingId);
          const label = `${formatDayLong(dateFromKey(day.key))} · ${formatHour(slot.hour)}`;
          return (
            <div
              key={slot.hour}
              className={`slot${unavailable && !bookingId ? " unavailable" : ""}`}
            >
              <div className="time">
                {formatHour(slot.hour)}
                {slot.prime && <span className="badge prime">Prime</span>}
              </div>
              <div className="spots">
                {slot.past
                  ? "—"
                  : `${Math.max(capacity - slot.count, 0)} of ${capacity} spots open`}
              </div>
              {slot.roster && slot.roster.length > 0 && !slot.past && (
                <div className="roster">
                  {slot.roster.map((p, i) => (
                    <span
                      key={i}
                      className={`chip${p.member ? " member" : ""}${p.team ? " team" : ""}`}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              {bookingId ? (
                <>
                  <div className="state reserved">
                    {target.name.split(" ")[0]} is in ✓
                  </div>
                  <button
                    className="link-btn"
                    onClick={() => remove(bookingId, label)}
                  >
                    Remove
                  </button>
                </>
              ) : slot.past ? (
                <div className="state">Past</div>
              ) : full ? (
                <div className="state">Full</div>
              ) : (
                <button
                  disabled={busyHour === slot.hour}
                  onClick={() => add(slot.hour)}
                >
                  {busyHour === slot.hour ? "Adding…" : `Add · $${rate}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
