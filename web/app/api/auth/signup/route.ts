import { NextResponse } from "next/server";
import { facility } from "@/lib/config";

// Public self-signup is intentionally disabled — 480 is a membership
// facility and accounts are created by staff (see /api/admin/users,
// action "create"). This stub keeps any old client pointed at the right
// path: call Warren.
export async function POST() {
  return NextResponse.json(
    {
      error: `Accounts are set up personally — please reach out to ${facility.ownerName} at ${facility.phoneDisplay} to set up your membership.`,
    },
    { status: 403 }
  );
}
