"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AuthNav() {
  // undefined = still checking; null = logged out
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return null;
  if (!user) return <Link href="/login">Log In</Link>;
  return (
    <>
      {user.role === "admin" && <Link href="/admin">Staff</Link>}
      <Link href="/account">{user.name.split(" ")[0]}</Link>
    </>
  );
}
