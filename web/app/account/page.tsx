"use client";

import { useCallback, useEffect, useState } from "react";
import { dateFromKey, formatDayLong, formatHour } from "@/lib/schedule";
import { downloadIcs } from "@/lib/ics";

type Booking = { id: number; date: string; hour: number; price: number };
type Person = { id: number; name: string; email: string };
type Pending = { id: number; name: string; email: string };

export default function AccountPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any | undefined>(undefined);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [friends, setFriends] = useState<Person[]>([]);
  const [incoming, setIncoming] = useState<Pending[]>([]);
  const [outgoing, setOutgoing] = useState<Pending[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [twoFa, setTwoFa] = useState<{ otpauth: string; secret: string; qr: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [card, setCard] = useState<any | null>(null);
  const [paymentsOn, setPaymentsOn] = useState(false);

  const load = useCallback(async () => {
    const me = await fetch("/api/me").then((r) => r.json());
    if (!me.user) {
      window.location.href = "/login?next=/account";
      return;
    }
    setUser(me.user);
    const [b, f, pm] = await Promise.all([
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/friends").then((r) => r.json()),
      fetch("/api/payment-method").then((r) => r.json()),
    ]);
    setBookings(b.bookings ?? []);
    setFriends(f.friends ?? []);
    setIncoming(f.incoming ?? []);
    setOutgoing(f.outgoing ?? []);
    setCard(pm.card ?? null);
    setPaymentsOn(!!pm.paymentsEnabled);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Returning from membership checkout on Stripe.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("activated") === "1" && params.get("session_id")) {
      fetch(`/api/stripe/verify?session_id=${params.get("session_id")}`)
        .then((r) => r.json())
        .then((v) => {
          setNotice(
            v.paid && v.type === "membership"
              ? { kind: "success", text: "Welcome to the club — your membership is active! You now book 21 days out at member rates." }
              : { kind: "error", text: "Membership payment didn't complete." }
          );
          load();
        });
      window.history.replaceState(null, "", "/account");
    } else if (params.get("canceled") === "1") {
      setNotice({ kind: "info", text: "Membership checkout canceled." });
      window.history.replaceState(null, "", "/account");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activateMembership() {
    const res = await fetch("/api/membership/checkout", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  async function cancelBooking(id: number) {
    const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    setNotice(
      res.ok
        ? { kind: "success", text: "Booking canceled." }
        : { kind: "error", text: data.error }
    );
    load();
  }

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: friendEmail }),
    });
    const data = await res.json();
    setNotice(
      res.ok
        ? { kind: "success", text: data.message }
        : { kind: "error", text: data.error }
    );
    if (res.ok) setFriendEmail("");
    load();
  }

  async function respond(id: number, accept: boolean) {
    await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, accept }),
    });
    load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function startTwoFa() {
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    const QRCode = (await import("qrcode")).default;
    const qr = await QRCode.toDataURL(data.otpauth, { width: 220, margin: 1 });
    setTwoFa({ otpauth: data.otpauth, secret: data.secret, qr });
  }

  async function confirmTwoFa(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", code: twoFaCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    setTwoFa(null);
    setTwoFaCode("");
    setNotice({
      kind: "success",
      text: "Two-factor authentication is on. You'll need a code from your app at every login.",
    });
    load();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: pwCurrent, next: pwNext }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    setPwCurrent("");
    setPwNext("");
    setShowPwForm(false);
    setNotice({
      kind: "success",
      text: "Password changed. Any other devices were logged out.",
    });
  }

  async function disableTwoFa(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable", code: disableCode }),
    });
    const data = await res.json();
    setDisableCode("");
    if (!res.ok) {
      setNotice({ kind: "error", text: data.error });
      return;
    }
    setNotice({ kind: "success", text: "Two-factor authentication is off." });
    load();
  }

  if (user === undefined) {
    return <p className="loading">Loading your account…</p>;
  }

  return (
    <>
      <h1 className="page-title">My Account</h1>
      {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}

      <section className="card block">
        <h3>
          {user.name}{" "}
          <span className={`tag ${user.isMember ? "member" : ""}`}>
            {user.isMember ? "Member" : "Guest"}
          </span>
        </h3>
        <p>{user.email}</p>
        {!user.isMember && (
          <p style={{ marginTop: 8 }}>
            Want the 3-week booking window and member rates?{" "}
            {paymentsOn ? (
              <button className="link-btn" onClick={activateMembership}>
                Activate membership — $1,000/yr →
              </button>
            ) : (
              <>
                <a href="/membership">See membership</a> — activation is
                handled at the front desk for now.
              </>
            )}
          </p>
        )}
        <button className="link-btn" onClick={logout}>
          Log out
        </button>
      </section>

      <section className="card block">
        <h3>
          Security{" "}
          <span className={`tag ${user.twoFactorEnabled ? "member" : ""}`}>
            {user.twoFactorEnabled ? "2FA On" : "2FA Off"}
          </span>
        </h3>
        <p style={{ marginBottom: 8 }}>
          <button className="link-btn" onClick={() => setShowPwForm(!showPwForm)}>
            {showPwForm ? "Cancel password change" : "Change password"}
          </button>
        </p>
        {showPwForm && (
          <form onSubmit={changePassword} style={{ marginBottom: 14 }}>
            <label className="field">
              Current password
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              New password (8+ characters)
              <input
                type="password"
                value={pwNext}
                onChange={(e) => setPwNext(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="btn small">Update Password</button>
          </form>
        )}
        {user.twoFactorEnabled ? (
          <>
            <p>
              Logins require a code from your authenticator app. To turn it
              off, enter a current code:
            </p>
            <form onSubmit={disableTwoFa} className="inline-form" style={{ marginTop: 10 }}>
              <input
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                required
              />
              <button className="btn small">Turn Off 2FA</button>
            </form>
          </>
        ) : twoFa ? (
          <>
            <p>
              Scan this with your authenticator app (Google Authenticator,
              Apple Passwords, Authy…), then enter the 6-digit code it shows:
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={twoFa.qr}
              alt="2FA setup QR code"
              style={{ display: "block", margin: "12px 0", borderRadius: 8 }}
            />
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
              Can&apos;t scan? Enter this key manually: <code>{twoFa.secret}</code>
            </p>
            <form onSubmit={confirmTwoFa} className="inline-form">
              <input
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
                autoFocus
                required
              />
              <button className="btn small">Confirm &amp; Enable</button>
            </form>
          </>
        ) : (
          <>
            <p>
              Add a second login step with an authenticator app. Recommended
              for staff, optional for everyone.
            </p>
            <button className="btn small" style={{ marginTop: 10 }} onClick={startTwoFa}>
              Enable 2FA
            </button>
          </>
        )}
      </section>

      <section className="card block">
        <h3>Payment Method</h3>
        {card ? (
          <div className="row">
            <span>
              {String(card.brand).toUpperCase()} •••• {card.last4}{" "}
              <small>
                exp {card.expMonth}/{card.expYear}
              </small>{" "}
              — used for one-tap booking
            </span>
            <button
              className="link-btn"
              onClick={async () => {
                await fetch("/api/payment-method", { method: "DELETE" });
                setNotice({ kind: "success", text: "Card removed." });
                load();
              }}
            >
              Remove
            </button>
          </div>
        ) : paymentsOn ? (
          <p>
            No card saved yet — it&apos;s stored automatically (by Stripe,
            never on our servers) the first time you pay online, and future
            bookings become one tap.
          </p>
        ) : (
          <p>
            Online payments aren&apos;t live yet — pay at the facility for
            now.
          </p>
        )}
      </section>

      <section className="card block">
        <h3>Upcoming Bookings</h3>
        {bookings.length === 0 ? (
          <p>
            Nothing booked yet. <a href="/book">Grab a slot →</a>
          </p>
        ) : (
          <ul className="rows">
            {bookings.map((b) => (
              <li key={b.id} className="row">
                <span>
                  {formatDayLong(dateFromKey(b.date))} · {formatHour(b.hour)} ·
                  ${b.price}
                </span>
                <span>
                  <button
                    className="link-btn"
                    onClick={() => downloadIcs(b.date, b.hour)}
                    title="Add to calendar"
                  >
                    📅
                  </button>{" "}
                  <button className="link-btn" onClick={() => cancelBooking(b.id)}>
                    Cancel
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card block">
        <h3>Friends</h3>
        <p style={{ marginBottom: 10 }}>
          Friends can see each other on the schedule and book times together.
        </p>
        <form onSubmit={addFriend} className="inline-form">
          <input
            type="email"
            placeholder="friend@email.com"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
            required
          />
          <button className="btn small">Add Friend</button>
        </form>

        {incoming.length > 0 && (
          <>
            <h4 className="row-head">Requests for you</h4>
            <ul className="rows">
              {incoming.map((p) => (
                <li key={p.id} className="row">
                  <span>
                    {p.name} <small>({p.email})</small>
                  </span>
                  <span>
                    <button className="link-btn" onClick={() => respond(p.id, true)}>
                      Accept
                    </button>{" "}
                    <button className="link-btn muted" onClick={() => respond(p.id, false)}>
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {friends.length > 0 ? (
          <ul className="rows">
            {friends.map((p) => (
              <li key={p.id} className="row">
                <span>
                  {p.name} <small>({p.email})</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 10 }}>No friends added yet.</p>
        )}

        {outgoing.length > 0 && (
          <>
            <h4 className="row-head">Waiting on them</h4>
            <ul className="rows">
              {outgoing.map((p) => (
                <li key={p.id} className="row">
                  <span>
                    {p.name} <small>({p.email})</small>
                  </span>
                  <small>Pending</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
