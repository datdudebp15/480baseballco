"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [acceptWaiver, setAcceptWaiver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password, acceptWaiver }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    window.location.href = "/book";
  }

  return (
    <div className="auth-card">
      <h1 className="page-title">Create Account</h1>
      <p className="page-sub">
        An account lets you book time, add friends, and keep a card on file.
      </p>
      {error && <div className="notice error">{error}</div>}
      <form onSubmit={submit}>
        <label className="field">
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          Phone (optional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </label>
        <label className="field">
          Password (8+ characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label
          className="field"
          style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={acceptWaiver}
            onChange={(e) => setAcceptWaiver(e.target.checked)}
            required
            style={{ width: 18, height: 18, marginTop: 2 }}
          />
          <span>
            I agree to the <a href="/terms" target="_blank">Terms of Service</a>{" "}
            and the <a href="/waiver" target="_blank">liability waiver</a>.
          </span>
        </label>
        <button className="btn wide" disabled={busy}>
          {busy ? "Creating…" : "Create Account"}
        </button>
      </form>
      <p className="auth-alt">
        Already have one? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
