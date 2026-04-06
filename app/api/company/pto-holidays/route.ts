import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getCompanyPtoPayload } from "@/lib/companyPtoServer";

/**
 * Company-wide PTO and holiday impacts for all active people, scoped to ~12 months of week
 * buckets from today (see {@link getCompanyPtoPayload}).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getCompanyPtoPayload(new Date());
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
