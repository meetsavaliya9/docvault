import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { formatStorageLimit } from "@/lib/billing";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { listSubscriptionPlans } from "@/lib/subscriptionPlans";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }
  if (!(await hasPermission(user, "VIEW_SUBSCRIPTION"))) {
    return NextResponse.json({ error: "You do not have permission to view subscription plans." }, { status: 403 });
  }

  try {
    const checkoutConfigured = Boolean(
      process.env.RAZORPAY_KEY_ID?.trim() &&
        process.env.RAZORPAY_KEY_SECRET?.trim()
    );
    const plans = await listSubscriptionPlans({ activeOnly: true });
    return NextResponse.json({
      plans: plans.map((plan) => ({
        ...plan,
        key: plan.slug,
        quotaBytes: plan.storageLimitBytes,
        quotaLabel: formatStorageLimit(plan.storageLimitBytes),
        maxDocuments: plan.documentLimit,
        checkoutAvailable: plan.price > 0 && checkoutConfigured,
      })),
      razorpayKeyId: checkoutConfigured ? getRazorpayCredentials().keyId : null,
    });
  } catch (error) {
    console.error("Failed to load billing plans:", error);
    return NextResponse.json(
      { error: "Could not load subscription plans. Please try again." },
      { status: 500 }
    );
  }
}
