import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getBillingSummary } from "@/lib/billing";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }
  if (!(await hasPermission(user, "VIEW_SUBSCRIPTION"))) {
    return NextResponse.json({ error: "You do not have permission to view subscription details." }, { status: 403 });
  }

  try {
    const billing = await getBillingSummary(user.id);
    if (!(await hasPermission(user, "VIEW_PAYMENT_HISTORY"))) {
      billing.latestPayment = null;
    }
    return NextResponse.json(billing, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to load subscription details:", error);
    return NextResponse.json(
      { error: "Could not load subscription details. Please try again." },
      { status: 500 }
    );
  }
}
