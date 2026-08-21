"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function finish() {
    window.location.href = params.get("next") ?? "/book";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    if (data.requires2fa) {
      setChallengeToken(data.token);
      return;
    }
    finish();
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: challengeToken, code }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      if (res.status === 401 && data.error?.includes("expired")) {
        setChallengeToken(null);
        setCode("");
      }
      return;
    }
    finish();
  }

  if (challengeToken) {
    return (
      <div className="auth-card">
        <h1 className="page-title">Two-Factor Code</h1>
        <p className="page-sub">
          Enter the 6-digit code from your authenticator app.
        </p>
        {error && <div className="notice error">{error}</div>}
        <form onSubmit={submitCode}>
          <label className="field">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button className="btn wide" disabled={busy}>
            {busy ? "Checking…" : "Verify"}
          </button>
        </form>
        <p className="auth-alt">
          <button
            className="link-btn"
            onClick={() => {
              setChallengeToken(null);
              setCode("");
              setError(null);
            }}
          >
            ← Back to login
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1 className="page-title">Log In</h1>
      {error && <div className="notice error">{error}</div>}
      <form onSubmit={submit}>
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
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="btn wide" disabled={busy}>
          {busy ? "Logging in…" : "Log In"}
        </button>
      </form>
      <p className="auth-alt">
        New to 480? <Link href="/signup">Get set up</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="loading">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
