import { audit, getDb, isoNow } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// Staff-only: download the whole business dataset as a JSON file. Crude but
// real insurance until paid point-in-time database recovery is in place.
// Includes password hashes (bcrypt) so a restore is complete — treat the
// downloaded file as sensitive.
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const db = await getDb();
  const backup = {
    exportedAt: isoNow(),
    exportedBy: user.email,
    users: await db.all("SELECT * FROM users ORDER BY id"),
    bookings: await db.all("SELECT * FROM bookings ORDER BY id"),
    friendships: await db.all("SELECT * FROM friendships ORDER BY id"),
    team_blocks: await db.all("SELECT * FROM team_blocks ORDER BY id"),
    audit_log: await db.all("SELECT * FROM audit_log ORDER BY id"),
  };
  await audit(db, user.email, "backup.export", `${backup.users.length} users, ${backup.bookings.length} bookings`);

  return new NextResponse(JSON.stringify(backup, null, 1), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="480-backup-${isoNow().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
