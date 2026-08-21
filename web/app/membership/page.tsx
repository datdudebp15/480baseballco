import Link from "next/link";
import { facility } from "@/lib/config";

export default function MembershipPage() {
  return (
    <>
      <h1 className="page-title" style={{ textAlign: "center" }}>
        Membership
      </h1>
      <p className="page-sub" style={{ textAlign: "center" }}>
        Serious about your swing? Members get the schedule before anyone else.
      </p>

      <div className="member-card">
        <div className="price">
          ${facility.subscriptionPrice.toLocaleString()}
        </div>
        <div className="per">per year</div>
        <ul>
          <li>
            Reserve any open hour up to {facility.memberWindowDays} days in
            advance
          </li>
          <li>
            Member rate: ${facility.memberHourlyRate}/hour (public pays $
            {facility.publicHourlyRate})
          </li>
          <li>First shot at prime-time evening and weekend slots</li>
          <li>See who&apos;s on the schedule — members and guests</li>
          <li>Add friends and book times together</li>
        </ul>
        <Link href="/signup" className="btn">
          Create Your Account
        </Link>
        <p
          style={{
            marginTop: "12px",
            fontSize: "13px",
            color: "var(--muted)",
          }}
        >
          Online membership checkout is coming — for now the front desk
          activates your membership on your account.
        </p>
        <p
          style={{
            marginTop: "14px",
            fontSize: "13px",
            color: "var(--muted)",
          }}
        >
          Want in now? Contact us and we&apos;ll set you up directly.
        </p>
      </div>

      <p style={{ textAlign: "center" }}>
        <Link href="/book">See the schedule first →</Link>
      </p>
    </>
  );
}
