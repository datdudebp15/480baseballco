import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";

// The club roster for the "hitting with" picker: names only (no emails),
// logged-in users only, friends sorted first.
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db.all(
    `SELECT id, name, is_member AS "isMember" FROM users WHERE id != ? ORDER BY name`,
    [user.id]
  );
  const fr = await db.all(
    `SELECT requester_id, addressee_id FROM friendships
     WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`,
    [user.id, user.id]
  );
  const friendIds = new Set(
    fr.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id))
  );
  const accounts = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      isMember: !!r.isMember,
      friend: friendIds.has(r.id),
    }))
    .sort((a, b) => Number(b.friend) - Number(a.friend) || a.name.localeCompare(b.name));
  return NextResponse.json({ accounts });
}
