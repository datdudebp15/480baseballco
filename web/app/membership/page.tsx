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
        <ul>
          <li>Train on the same Trajekt Arc used by MLB clubs</li>
          <li>Reserve up to {facility.memberWindowDays} days in advance —
            before anyone else</li>
          <li>Member rates on every session</li>
          <li>First shot at prime-time evening and weekend slots</li>
          <li>See who&apos;s on the schedule — members and guests</li>
          <li>Add friends and book times together</li>
        </ul>
        <p style={{ marginBottom: 18, fontSize: 15, lineHeight: 1.6 }}>
          Membership is set up personally. Reach out to{" "}
          <strong>{facility.ownerName}</strong> for details and pricing:
        </p>
        <a href={`tel:${facility.phoneTel}`} className="btn">
          Call or Text {facility.phoneDisplay}
        </a>
      </div>

      <p style={{ textAlign: "center" }}>
        <Link href="/book">See the schedule first →</Link>
      </p>
    </>
  );
}
