import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { listSubscriptionPlans } from "@/lib/subscriptionPlans";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }
  if (!(await hasPermission(user, "VIEW_PLANS"))) {
    return NextResponse.json({ error: "You do not have permission to view subscription plans." }, { status: 403 });
  }

  try {
    const plans = await listSubscriptionPlans({ activeOnly: true });
    const checkoutConfigured = Boolean(
      process.env.RAZORPAY_KEY_ID?.trim() &&
        process.env.RAZORPAY_KEY_SECRET?.trim()
    );
    return NextResponse.json(
      {
        plans: plans.map((plan) => ({
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billingPeriod: plan.billingPeriod,
          description: plan.description,
          features: plan.features,
          documentLimit: plan.documentLimit,
          storageLimitBytes: plan.storageLimitBytes,
          isRecommended: plan.isRecommended,
          checkoutAvailable: plan.price > 0 && checkoutConfigured,
        })),
        razorpayKeyId: checkoutConfigured ? getRazorpayCredentials().keyId : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to load active subscription plans:", error);
    return NextResponse.json(
      { error: "Could not load subscription plans. Please try again." },
      { status: 500 }
    );
  }
}
