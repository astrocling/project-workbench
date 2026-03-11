import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { getEligibleKeyRoles } from "@/lib/eligibleKeyRoles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getEligibleKeyRoles();
  return NextResponse.json(result);
}
