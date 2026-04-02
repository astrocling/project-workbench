import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { floatClientFromEnv } from "@/lib/float/client";
import { FloatApiError } from "@/lib/float/types";
import { filterHolidayRowsOverlappingYmdWindow } from "@/lib/float/excludedDays";
import { defaultFloatSyncDateRange } from "@/lib/float/syncFloatImport";

/**
 * GET — list Float public + team holidays for a date window (server-side token).
 * Query: `start`, `end` (YYYY-MM-DD), default ~±12 months UTC like sync.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let client;
  try {
    client = floatClientFromEnv();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Float client configuration error";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const range = defaultFloatSyncDateRange();
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start")?.trim() || range.start;
  const endDate = searchParams.get("end")?.trim() || range.end;

  try {
    const [publicHolidays, teamHolidaysRaw] = await Promise.all([
      client.listAllPages<Record<string, unknown>>("/v3/public-holidays", {
        start_date: startDate,
        end_date: endDate,
      }),
      client.listAllPages<Record<string, unknown>>("/v3/holidays"),
    ]);
    const teamHolidays = filterHolidayRowsOverlappingYmdWindow(
      teamHolidaysRaw,
      startDate,
      endDate
    );
    return NextResponse.json({
      startDate,
      endDate,
      publicHolidays,
      teamHolidays,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Float API request failed";
    const body = e instanceof FloatApiError ? e.responseBody : undefined;
    return NextResponse.json(
      { error: "Failed to load Float holidays", details: body ?? msg },
      { status: 502 }
    );
  }
}
