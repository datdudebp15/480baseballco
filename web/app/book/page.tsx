"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dateFromKey,
  formatDayLong,
  formatDayShort,
  formatHour,
} from "@/lib/schedule";

type RosterEntry = { name: string; member: boolean; friend: boolean; team?: boolean };
type Slot = {
  hour: number;
  prime: boolean;
  past: boolean;
  count: number;
  mine: number | null;
  roster?: RosterEntry[];
  friends?: string[];
};
type Day = { key: string; daysOut: number; membersOnly: boolean };
type Schedule = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any | null;
  capacity: number;
  rates: { member: number; public: number; firstSession: number };
  firstSessionEligible: boolean;
  windows: { member: number; public: number };
  days: Day[];
  slots: Record<string, Slot[]>;
};

export default function BookPage() {
  const [data, setData] = useState<Schedule | null>(null);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [busyHour, setBusyHour] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/schedule");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <p className="loading">Loading schedule…</p>;
  }

  const { user, capacity, rates, windows, days } = data;
  const day = days[selected];
  const slots = data.slots[day.key] ?? [];
  const isMember = !!user && (user.isMember || user.role === "admin");
  const lockedOut = day.membersOnly && !isMember;
  const rate = data.firstSessionEligible
    ? rates.firstSession
    : isMember
      ? rates.member
      : rates.public;

  async function book(slot: Slot) {
    if (!user) {
      window.location.href = "/login?next=/book";
      return;
    }
    setBusyHour(slot.hour);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: day.key, hour: slot.hour }),
    });
    const result = await res.json();
    setBusyHour(null);
    setNotice(
      res.ok
        ? {
            kind: "success",
            text: `Booked: ${formatDayLong(dateFromKey(day.key))} at ${formatHour(slot.hour)} — $${result.price}. (Pay at the facility until online payments launch.)`,
          }
        : { kind: "error", text: result.error }
    );
    load();
  }

  async function cancel(slot: Slot) {
    if (!slot.mine) return;
    setBusyHour(slot.hour);
    const res = await fetch(`/api/bookings?id=${slot.mine}`, { method: "DELETE" });
    const result = await res.json();
    setBusyHour(null);
    setNotice(
      res.ok
        ? { kind: "success", text: "Booking canceled." }
        : { kind: "error", text: result.error }
    );
    load();
  }

  return (
    <>
      <h1 className="page-title">Book Cage Time</h1>
      <p className="page-sub">
        Members reserve up to {windows.member} days ahead — public booking
        opens {windows.public} days before each date. All sessions are one
        hour, {capacity} spots per hour.
      </p>

      {!user && (
        <div className="notice info">
          <a href="/login?next=/book">Log in</a> to book. New to 480? Reach
          out to Warren Holzemer at{" "}
          <a href="tel:+17037555977">(703) 755-5977</a> to set up your
          membership — <a href="/signup">details here</a>. Your first session
          is just ${rates.firstSession}.
        </div>
      )}

      {data.firstSessionEligible && (
        <div className="notice success">
          First session special: your first hour is ${rates.firstSession}{" "}
          (normally ${rates.public}). It&apos;s applied automatically at
          booking.
        </div>
      )}

      <div className="day-strip">
        {days.map((d, i) => {
          const dt = dateFromKey(d.key);
          const { weekday, day: num } = formatDayShort(dt);
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
              {d.membersOnly && !isMember && <span className="lock">Members</span>}
            </button>
          );
        })}
      </div>

      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      {lockedOut && (
        <div className="notice info">
          <strong>{formatDayLong(dateFromKey(day.key))}</strong> is more than{" "}
          {windows.public} days out, so it&apos;s open to members only right
          now. Public booking opens in{" "}
          {day.daysOut - windows.public} day
          {day.daysOut - windows.public === 1 ? "" : "s"} — or{" "}
          <a href="/membership">become a member</a> and book it today.
        </div>
      )}

      <div className="slot-grid">
        {slots.map((slot) => {
          const full = slot.count >= capacity;
          const unavailable = slot.past || (full && !slot.mine) || (lockedOut && !slot.mine);
          return (
            <div
              key={slot.hour}
              className={`slot${unavailable && !slot.mine ? " unavailable" : ""}`}
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
                      className={`chip${p.member ? " member" : ""}${p.friend ? " friend" : ""}${p.team ? " team" : ""}`}
                      title={p.team ? "Team block" : p.member ? "Member" : "Guest"}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              {!slot.roster && slot.friends && slot.friends.length > 0 && !slot.past && (
                <div className="roster">
                  <span className="friends-note">
                    Friends here: {slot.friends.join(", ")}
                  </span>
                </div>
              )}

              <div className="price">${rate}/hr</div>

              {slot.mine ? (
                <>
                  <div className="state reserved">Reserved ✓</div>
                  <button
                    className="link-btn"
                    disabled={busyHour === slot.hour}
                    onClick={() => cancel(slot)}
                  >
                    Cancel
                  </button>
                </>
              ) : slot.past ? (
                <div className="state">Past</div>
              ) : full ? (
                <div className="state">Full</div>
              ) : lockedOut ? (
                <div className="state">Members Only</div>
              ) : (
                <button
                  disabled={busyHour === slot.hour}
                  onClick={() => book(slot)}
                >
                  {busyHour === slot.hour ? "Booking…" : user ? "Book" : "Log In to Book"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
