import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Deployment diagnostics: reports which database mode the app is in and
// whether it can actually connect. Reveals no secrets (host name only).
export async function GET() {
  const url = process.env.DATABASE_URL;
  let dbHost: string | null = null;
  try {
    if (url) dbHost = new URL(url).hostname;
  } catch {
    dbHost = "unparseable DATABASE_URL";
  }

  try {
    const db = await getDb();
    const row = await db.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
    return NextResponse.json({
      ok: true,
      mode: url ? "postgres" : "sqlite",
      dbHost,
      users: Number(row?.c ?? 0),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        mode: url ? "postgres" : "sqlite",
        dbHost,
        error: (e as Error).message,
      },
      { status: 500 }
    );
  }
}
