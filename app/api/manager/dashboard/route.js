import { NextResponse } from "next/server";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { getManagerDashboardData } from "@/lib/managerData";
import { getUserPermissions } from "@/lib/permissions";
import { logSafeServerError } from "@/lib/auth/errorDiagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_RANGES = new Set(["today", "7d", "30d", "month", "all"]);

export async function GET(request) {
  const { user, response } = await requireManagerPermission("VIEW_DASHBOARD");
  if (response) return response;

  try {
    const requestedRange = new URL(request.url).searchParams.get("range");
    const range = ALLOWED_RANGES.has(requestedRange) ? requestedRange : "30d";
    const permissions = await getUserPermissions(user);
    const dashboard = await getManagerDashboardData(permissions, range);

    return NextResponse.json(dashboard, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logSafeServerError("Manager dashboard data fetch failed", error);
    return NextResponse.json(
      { error: "Could not load dashboard data right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
