export const metadata = { title: "Privacy Policy · 480 Hitting Co." };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 className="page-title">Privacy Policy</h1>
      <div className="notice info">
        DRAFT — placeholder language. Replace with counsel-reviewed policy
        before launch.
      </div>
      <div className="card block" style={{ lineHeight: 1.7 }}>
        <p>
          <strong>What we collect.</strong> Your name, email, phone (optional),
          and booking history — the minimum needed to run reservations.
          Passwords are stored only as salted hashes.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Payments.</strong> Card details are processed and stored by
          our payment processor (Stripe); they never touch our servers.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Visibility.</strong> If you book a session, members of the
          facility can see your name on the schedule for that hour. Friends
          you add can see your bookings. We never sell your information.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Deletion.</strong> Email us to delete your account; booking
          records needed for accounting are retained as required by law.
        </p>
      </div>
    </div>
  );
}
