import Link from "next/link";
import { facility } from "@/lib/config";

export const metadata = { title: "Get Set Up · 480 Hitting Co." };

// Accounts are created personally, not self-serve — 480 is a membership
// facility. This page routes prospective hitters to Warren.
export default function SignupPage() {
  return (
    <div className="auth-card" style={{ textAlign: "center" }}>
      <h1 className="page-title">Get Set Up</h1>
      <p className="page-sub" style={{ marginBottom: 18 }}>
        480 Hitting Co. is a private facility — accounts are set up
        personally, not online.
      </p>
      <p style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 20 }}>
        Please reach out to <strong>{facility.ownerName}</strong> to set up
        your membership:
      </p>
      <a
        href={`tel:${facility.phoneTel}`}
        className="btn wide"
        style={{ fontSize: 18, marginBottom: 14, display: "block" }}
      >
        Call or Text {facility.phoneDisplay}
      </a>
      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
        We&apos;ll walk you through the facility, membership options and
        pricing, and get you in the lane.
      </p>
      <p className="auth-alt">
        Already set up? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
