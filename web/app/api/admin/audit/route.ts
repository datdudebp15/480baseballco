import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Staff-only: recent staff activity, newest first.
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const db = await getDb();
  const entries = await db.all(
    `SELECT actor_email AS "actorEmail", action, detail, created_at AS "createdAt"
     FROM audit_log ORDER BY id DESC LIMIT 30`
  );
  return NextResponse.json({ entries });
}
