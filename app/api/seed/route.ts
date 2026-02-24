import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/lib/seed";

/**
 * One-time seed endpoint for production (e.g. Neon via Vercel).
 * Set SEED_SECRET in Vercel, then:
 *   curl -X POST "https://your-app.vercel.app/api/seed" -H "Authorization: Bearer YOUR_SEED_SECRET"
 * Optionally set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in Vercel for the admin user.
 */
export async function POST(request: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRET is not configured" },
      { status: 501 }
    );
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSeed(prisma);
    return NextResponse.json({
      ok: true,
      message: `Seeded ${result.roles} roles and admin user ${result.adminEmail}`,
    });
  } catch (e) {
    console.error("Seed failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
