import Link from "next/link";

export const metadata = { title: "Foul Ball · 480 Hitting Co." };

export default function NotFound() {
  return (
    <section className="hero" style={{ paddingTop: 70 }}>
      <div className="script">Out of Play</div>
      <h1>Foul Ball</h1>
      <p>
        That page doesn&apos;t exist — but the lane&apos;s still open.
      </p>
      <div className="buttons">
        <Link href="/" className="btn">
          Back Home
        </Link>
        <Link href="/book" className="btn outline">
          Book Time
        </Link>
      </div>
    </section>
  );
}
