import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listSubscriptionPlans } from "@/lib/subscriptionPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    return NextResponse.json({
      plans: (await listSubscriptionPlans()).map((plan) => ({
        key: plan.slug,
        name: plan.name,
        amount: plan.price,
        currency: plan.currency,
        billingPeriod: plan.billingPeriod,
        isActive: plan.isActive,
        isRecommended: plan.isRecommended,
        checkoutAvailable: plan.price > 0 && Boolean(
          process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()
        ),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin plan pricing fetch failed:", error);
    return NextResponse.json(
      { error: "Could not load subscription pricing." },
      { status: 500 }
    );
  }
}

export async function PUT() {
  const { response } = await requireAdmin();
  if (response) return response;

  return NextResponse.json(
    { error: "Update pricing in Admin → Pricing Management." },
    { status: 410 }
  );
}
