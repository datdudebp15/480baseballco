import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";

// My friends, plus pending requests in both directions.
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const db = await getDb();
  const friends = await db.all(
    `SELECT f.id AS "friendshipId", u.id, u.name, u.email
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
     ORDER BY u.name`,
    [user.id, user.id, user.id]
  );
  const incoming = await db.all(
    `SELECT f.id, u.name, u.email FROM friendships f
     JOIN users u ON u.id = f.requester_id
     WHERE f.status = 'pending' AND f.addressee_id = ?`,
    [user.id]
  );
  const outgoing = await db.all(
    `SELECT f.id, u.name, u.email FROM friendships f
     JOIN users u ON u.id = f.addressee_id
     WHERE f.status = 'pending' AND f.requester_id = ?`,
    [user.id]
  );
  return NextResponse.json({ friends, incoming, outgoing });
}

// Send a friend request by email. If they already requested me, that counts
// as mutual interest and we connect immediately.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").trim().toLowerCase();

  const db = await getDb();
  const target = await db.get<{ id: number; name: string }>(
    "SELECT id, name FROM users WHERE email = ?",
    [email]
  );

  if (!target) {
    return NextResponse.json(
      { error: "No account found with that email — ask them to sign up first." },
      { status: 404 }
    );
  }
  if (target.id === user.id) {
    return NextResponse.json(
      { error: "That's you — you two are already close." },
      { status: 400 }
    );
  }

  const existing = await db.get<{
    id: number;
    requester_id: number;
    status: string;
  }>(
    `SELECT id, requester_id, status FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?)
        OR (requester_id = ? AND addressee_id = ?)`,
    [user.id, target.id, target.id, user.id]
  );

  if (existing?.status === "accepted") {
    return NextResponse.json(
      { error: `You and ${target.name} are already friends.` },
      { status: 409 }
    );
  }
  if (existing?.status === "pending") {
    if (existing.requester_id === user.id) {
      return NextResponse.json(
        { error: "Request already sent — waiting on them." },
        { status: 409 }
      );
    }
    await db.run("UPDATE friendships SET status = 'accepted' WHERE id = ?", [existing.id]);
    return NextResponse.json({ message: `You and ${target.name} are now friends!` });
  }

  await db.run(
    "INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)",
    [user.id, target.id]
  );
  return NextResponse.json({ message: `Request sent to ${target.name}.` });
}
