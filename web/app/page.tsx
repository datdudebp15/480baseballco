import Link from "next/link";
import { facility } from "@/lib/config";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="script">Est. 2026 · Mesa, Arizona</div>
        <h1>
          Reserve Your
          <br />
          Cage Time
        </h1>
        <p>
          A private hitting facility built for serious ballplayers. Three spots
          every hour — pick yours and get to work.
        </p>
        <div className="buttons">
          <Link href="/book" className="btn">
            Book Time
          </Link>
          <Link href="/membership" className="btn outline">
            Become a Member
          </Link>
        </div>
      </section>

      <section className="cards">
        <div className="card">
          <div className="big">{facility.memberWindowDays} Days</div>
          <h3>Members Book First</h3>
          <p>
            A ${facility.subscriptionPrice.toLocaleString()} membership locks
            in your right to reserve any open hour up to three weeks in
            advance — before anyone else can.
          </p>
        </div>
        <div className="card">
          <div className="big">{facility.publicWindowDays} Days</div>
          <h3>Open Booking</h3>
          <p>
            Not a member? No problem. Any spots still open inside one week are
            available to everyone. Pay by the hour and hit.
          </p>
        </div>
        <div className="card">
          <div className="big">{facility.capacityPerHour} / Hour</div>
          <h3>Spots Per Hour</h3>
          <p>
            Every hour has {facility.capacityPerHour} reservable spots. Book
            one, show up, and the time is yours — prepaid, no waiting around.
          </p>
        </div>
      </section>
    </>
  );
}
