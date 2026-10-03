"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dateFromKey,
  formatDayLong,
  formatDayShort,
  formatHour,
} from "@/lib/schedule";
import { downloadIcsSet } from "@/lib/ics";

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
  rates: { member: number; public: number; firstSession: number } | null;
  firstSessionEligible: boolean;
  windows: { member: number; public: number };
  days: Day[];
  slots: Record<string, Slot[]>;
};

export default function BookPage() {
  const [data, setData] = useState<Schedule | null>(null);
  const [selected, setSelected] = useState(0);
  const [picked, setPicked] = useState<number[]>([]); // hours selected Photos-style
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [justBooked, setJustBooked] = useState<{ date: string; hours: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const MAX_PICK = 3;
  const noticeRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/schedule");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Returning from Stripe Checkout: verify the payment server-side, or
  // release the held slot if they backed out.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1" && params.get("session_id")) {
      fetch(`/api/stripe/verify?session_id=${params.get("session_id")}`)
        .then((r) => r.json())
        .then((v) => {
          setNotice(
            v.paid
              ? { kind: "success", text: "Payment confirmed — you're booked! A receipt is in your Stripe email." }
              : { kind: "error", text: "Payment didn't complete — your slot was not booked." }
          );
          load();
        });
      window.history.replaceState(null, "", "/book");
    } else if (params.get("canceled") === "1") {
      const held = (params.get("booking") ?? "").split(",").filter(Boolean);
      Promise.all(
        held.map((id) => fetch(`/api/bookings?id=${id}`, { method: "DELETE" }))
      ).then(() => load());
      setNotice({ kind: "info", text: "Checkout canceled — the time was released." });
      window.history.replaceState(null, "", "/book");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirmations must be seen: booking from low on the page would otherwise
  // leave the banner scrolled out of view.
  useEffect(() => {
    if (notice) {
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [notice]);

  if (!data) {
    return (
      <>
        <h1 className="page-title">Book Cage Time</h1>
        <div className="day-strip">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="ghost ghost-chip" />
          ))}
        </div>
        <div className="slot-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="ghost ghost-slot" />
          ))}
        </div>
      </>
    );
  }

  const { user, capacity, rates, windows, days } = data;
  const day = days[selected];
  const allSlots = data.slots[day.key] ?? [];
  // Today's already-started hours are dead cards — drop them.
  const slots = day.daysOut === 0 ? allSlots.filter((s) => !s.past) : allSlots;
  const isMember = !!user && (user.isMember || user.role === "admin");
  const lockedOut = day.membersOnly && !isMember;
  const rate = rates
    ? data.firstSessionEligible
      ? rates.firstSession
      : isMember
        ? rates.member
        : rates.public
    : null;

  // Open spots per day, for the at-a-glance counts on the chips.
  const openCount = (d: Day) =>
    (data.slots[d.key] ?? [])
      .filter((s) => !s.past)
      .reduce((sum, s) => sum + Math.max(0, capacity - s.count), 0);

  function togglePick(slot: Slot) {
    if (!user) {
      window.location.href = "/login?next=/book";
      return;
    }
    setNotice(null);
    setPicked((prev) => {
      if (prev.includes(slot.hour)) return prev.filter((h) => h !== slot.hour);
      if (prev.length >= MAX_PICK) {
        setNotice({
          kind: "info",
          text: `Up to ${MAX_PICK} sessions per checkout — unselect one first.`,
        });
        return prev;
      }
      return [...prev, slot.hour];
    });
  }

  async function bookPicked() {
    if (picked.length === 0) return;
    const hours = [...picked].sort((a, b) => a - b);
    setBusy(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: day.key, hours }),
    });
    const result = await res.json();
    if (res.ok && result.checkoutUrl) {
      // Slots are held for 30 minutes while they pay on Stripe's page.
      window.location.href = result.checkoutUrl;
      return;
    }
    setBusy(false);
    if (res.ok) setPicked([]);
    setJustBooked(res.ok ? { date: day.key, hours } : null);
    const span = hours.map(formatHour).join(", ");
    setNotice(
      res.ok
        ? {
            kind: "success",
            text: result.paid
              ? `Booked & paid: ${formatDayLong(dateFromKey(day.key))} at ${span} — $${result.price} charged to your ${result.card}.`
              : `Booked: ${formatDayLong(dateFromKey(day.key))} at ${span} — $${result.price}. (Pay at the facility.)`,
          }
        : { kind: "error", text: result.error }
    );
    load();
  }

  async function cancel(slot: Slot) {
    if (!slot.mine) return;
    setBusy(true);
    const res = await fetch(`/api/bookings?id=${slot.mine}`, { method: "DELETE" });
    const result = await res.json();
    setBusy(false);
    setNotice(
      res.ok
        ? { kind: "success", text: "Booking canceled." }
        : { kind: "error", text: result.error }
    );
    load();
  }

  // Day strip with a month divider wherever the month changes.
  const strip: React.ReactNode[] = [];
  days.forEach((d, i) => {
    const dt = dateFromKey(d.key);
    if (i > 0 && dt.getDate() === 1) {
      strip.push(
        <div key={`m-${d.key}`} className="month-chip">
          {dt.toLocaleDateString("en-US", { month: "long" })}
        </div>
      );
    }
    const { weekday, day: num } = formatDayShort(dt);
    const open = openCount(d);
    strip.push(
      <button
        key={d.key}
        className={`day-chip${i === selected ? " selected" : ""}`}
        onClick={() => {
          setSelected(i);
          setNotice(null);
          setJustBooked(null);
          setPicked([]);
        }}
      >
        <span className="wd">{i === 0 ? "Today" : weekday}</span>
        <span className="num">{num}</span>
        {d.membersOnly && !isMember ? (
          <span className="lock">Members</span>
        ) : (
          <span className={`avail${open === 0 ? " full" : ""}`}>
            {open === 0 ? "Full" : `${open} open`}
          </span>
        )}
      </button>
    );
  });

  return (
    <>
      <h1 className="page-title">Book Cage Time</h1>
      <p className="page-sub">
        Members reserve up to {windows.member} days ahead — public booking
        opens {windows.public} days before each date. Each session is a
        private hour: one booking covers the lane, bring up to two training
        partners. Sessions run 50 minutes; the last 10 reset the lane — book
        back-to-back hours to keep it rolling.
      </p>

      {user && (
        <p className="page-sub" style={{ marginTop: -8 }}>
          Tap the hours you want (up to {MAX_PICK}), then book them together.
        </p>
      )}

      {!user && (
        <div className="notice info">
          <a href="/login?next=/book">Log in</a> to book. New to 480? Call or
          text <a href="tel:+17037555977">(703) 755-5977</a> to set up your
          membership — <a href="/signup">details here</a>.
        </div>
      )}

      {data.firstSessionEligible && rates && (
        <div className="notice success">
          First session special: your first hour is ${rates.firstSession}{" "}
          (normally ${rates.public}). It&apos;s applied automatically at
          booking.
        </div>
      )}

      <div className="day-strip">{strip}</div>

      <h2 className="day-heading">
        {day.daysOut === 0 ? "Today — " : ""}
        {formatDayLong(dateFromKey(day.key))}
      </h2>

      {notice && (
        <div ref={noticeRef} className={`notice ${notice.kind}`}>
          {notice.text}
          {notice.kind === "success" && justBooked && (
            <>
              {" "}
              <button
                className="link-btn"
                onClick={() => downloadIcsSet(justBooked.date, justBooked.hours)}
              >
                📅 Add to Calendar
              </button>
            </>
          )}
        </div>
      )}

      {lockedOut && (
        <div className="notice info">
          <strong>{formatDayLong(dateFromKey(day.key))}</strong> is more than{" "}
          {windows.public} days out, so it&apos;s open to members only right
          now. Public booking opens in {day.daysOut - windows.public} day
          {day.daysOut - windows.public === 1 ? "" : "s"} — or{" "}
          <a href="/membership">become a member</a> and book it today.
        </div>
      )}

      {slots.length === 0 ? (
        <p className="page-sub">
          That&apos;s a wrap for today — pick another day to keep hitting.
        </p>
      ) : (
        <div className="slot-grid">
          {slots.map((slot) => {
            const full = slot.count >= capacity;
            const unavailable =
              slot.past || (full && !slot.mine) || (lockedOut && !slot.mine);
            const selectable = !!user && !slot.past && !full && !lockedOut && !slot.mine;
            const isPicked = picked.includes(slot.hour);
            return (
              <div
                key={slot.hour}
                className={`slot${unavailable && !slot.mine ? " unavailable" : ""}${selectable ? " selectable" : ""}${isPicked ? " picked" : ""}`}
                onClick={selectable ? () => togglePick(slot) : undefined}
              >
                {isPicked && <span className="sel-badge">✓</span>}
                <div className="time">{formatHour(slot.hour)}</div>
                <div className="spots">
                  {slot.past
                    ? "—"
                    : slot.count >= capacity
                      ? "Booked"
                      : "Open: your hour, up to 3 hitters"}
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

                {rate !== null && <div className="price">${rate}/hr</div>}

                {slot.mine ? (
                  <>
                    <div className="state reserved">Reserved ✓</div>
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        cancel(slot);
                      }}
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
                ) : !user ? (
                  <button onClick={() => togglePick(slot)}>Log In to Book</button>
                ) : (
                  <div className={`state${isPicked ? " reserved" : ""}`}>
                    {isPicked ? "Selected ✓" : "Tap to select"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {picked.length > 0 && (
        <div className="action-bar">
          <span className="ab-summary">
            {picked.length} session{picked.length > 1 ? "s" : ""}
            {" · "}
            {[...picked].sort((a, b) => a - b).map(formatHour).join(", ")}
            {rates && (
              <strong>
                {" · $"}
                {data.firstSessionEligible
                  ? rates.firstSession +
                    (isMember ? rates.member : rates.public) * (picked.length - 1)
                  : (isMember ? rates.member : rates.public) * picked.length}
              </strong>
            )}
          </span>
          <span>
            <button className="link-btn" onClick={() => setPicked([])}>
              Clear
            </button>{" "}
            <button className="btn small" disabled={busy} onClick={bookPicked}>
              {busy ? "Booking…" : "Book"}
            </button>
          </span>
        </div>
      )}
    </>
  );
}
