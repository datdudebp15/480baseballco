export const metadata = { title: "Terms of Service · 480 Hitting Co." };

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 className="page-title">Terms of Service</h1>
      <div className="notice info">
        DRAFT — placeholder language. Replace with counsel-reviewed terms
        before launch.
      </div>
      <div className="card block" style={{ lineHeight: 1.7 }}>
        <p>
          <strong>Bookings.</strong> Sessions are one hour, limited to three
          participants per hour. A reservation is confirmed when payment
          completes. Arrive ready; time lost to late arrival is not extended
          or refunded.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Cancellations.</strong> Bookings canceled more than 24 hours
          before the start time receive a full refund. Inside 24 hours,
          bookings are non-refundable except at the Facility&apos;s
          discretion.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Membership.</strong> Membership grants an extended booking
          window and member pricing for the named individual only. It is
          non-transferable. The Facility may revoke membership for misuse,
          with a pro-rated refund.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Conduct &amp; equipment.</strong> Follow staff instructions
          and posted rules. Damage beyond normal wear caused by misuse may be
          charged to your account.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Privacy.</strong> See our <a href="/privacy">Privacy
          Policy</a> for how account data is handled.
        </p>
      </div>
    </div>
  );
}
