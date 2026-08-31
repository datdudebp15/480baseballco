import { NextResponse, type NextRequest } from "next/server";

// Cross-origin write protection: browsers send an Origin header on
// state-changing requests; if it's present and doesn't match this host,
// refuse. Same-site cookies already block classic CSRF — this is the
// explicit second lock.
export function middleware(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host");
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json(
            { error: "Cross-origin request blocked." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
