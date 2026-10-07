import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listSubscriptionPlans } from "@/lib/subscriptionPlans";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    return NextResponse.json(
      { plans: await listSubscriptionPlans() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Could not load admin subscription plans:", error);
    return NextResponse.json(
      { error: "Could not load pricing settings." },
      { status: 500 }
    );
  }
}
