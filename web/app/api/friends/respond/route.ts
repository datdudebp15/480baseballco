import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Accept or decline an incoming friend request.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const accept = !!body?.accept;

  const db = await getDb();
  const row = await db.get(
    `SELECT id FROM friendships
     WHERE id = ? AND addressee_id = ? AND status = 'pending'`,
    [id, user.id]
  );
  if (!row) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (accept) {
    await db.run("UPDATE friendships SET status = 'accepted' WHERE id = ?", [id]);
  } else {
    await db.run("DELETE FROM friendships WHERE id = ?", [id]);
  }
  return NextResponse.json({ ok: true });
}
