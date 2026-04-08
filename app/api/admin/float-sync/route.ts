import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { floatClientFromEnv } from "@/lib/float";
import { executeFloatApiSync } from "@/lib/float/syncFloatImport";
import { floatImportRatelimit, getClientIp } from "@/lib/ratelimit";
import { FloatApiError } from "@/lib/float/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lastRun = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });
  return NextResponse.json(lastRun);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const permissions = (session.user as { permissions?: string }).permissions;
    if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rateLimitId = (session.user as { id?: string }).id ?? getClientIp(req.headers);
    const { success } = await floatImportRatelimit.limit(rateLimitId);
    if (!success) {
      return NextResponse.json(
        { error: "Too many sync requests. Try again later." },
        { status: 429 }
      );
    }

    let body: { startDate?: string; endDate?: string } = {};
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = (await req.json()) as { startDate?: string; endDate?: string };
      } catch {
        body = {};
      }
    }

    let client;
    try {
      client = floatClientFromEnv();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "Float API is not configured", details: message },
        { status: 503 }
      );
    }

    const uploadedByUserId = (session.user as { id?: string }).id ?? null;

    const { run, unknownRoles } = await executeFloatApiSync(prisma, client, {
      startDate: body.startDate,
      endDate: body.endDate,
      uploadedByUserId,
    });

    /** `GET /api/projects/[id]/resourcing` uses `unstable_cache` with tags `project-resourcing` and `project-resourcing:{id}`; one global revalidation invalidates all resourcing caches after sync. */
    revalidateTag("project-resourcing", "max");

    return NextResponse.json({
      ok: true,
      run: {
        id: run.id,
        completedAt: run.completedAt,
        unknownRoles,
      },
    });
  } catch (err) {
    if (err instanceof FloatApiError) {
      return NextResponse.json(
        {
          error: "Float API request failed",
          status: err.status,
          details: err.message,
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Float sync failed", details: message },
      { status: 500 }
    );
  }
}
