export const metadata = { title: "Liability Waiver · 480 Hitting Co." };

export default function WaiverPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 className="page-title">Liability Waiver &amp; Release</h1>
      <div className="notice info">
        DRAFT — placeholder language. Replace with the counsel-reviewed waiver
        before launch.
      </div>
      <div className="card block" style={{ lineHeight: 1.7 }}>
        <p>
          In consideration of being permitted to use the facilities and
          equipment of 480 Hitting Co. (&quot;the Facility&quot;), including
          pitching machines operating at game velocities, I acknowledge and
          agree:
        </p>
        <ol style={{ paddingLeft: 22, marginTop: 10 }}>
          <li>
            Baseball and softball training involves inherent risks, including
            serious bodily injury from batted or pitched balls, equipment, and
            physical exertion. I knowingly and voluntarily assume all such
            risks.
          </li>
          <li>
            I release and hold harmless 480 Hitting Co., its owners, staff,
            and agents from any claims arising out of my use of the Facility,
            to the fullest extent permitted by Arizona law.
          </li>
          <li>
            I am physically fit to participate, will use required protective
            equipment (helmets are mandatory in the lane), and will follow all
            posted rules and staff instructions.
          </li>
          <li>
            For participants under 18, a parent or legal guardian must accept
            this waiver on the minor&apos;s behalf.
          </li>
        </ol>
        <p style={{ marginTop: 10 }}>
          Acceptance is recorded electronically when you create an account.
        </p>
      </div>
    </div>
  );
}
