import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { syncRazorpaySubscription, verifyRazorpayCheckoutSignature, razorpayRequest } from "@/lib/razorpay";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }
  if (!(await hasPermission(user, "CHANGE_SUBSCRIPTION"))) {
    return NextResponse.json({ error: "You do not have permission to manage subscriptions." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature } = body || {};
  if (
    typeof paymentId !== "string" ||
    typeof subscriptionId !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "Razorpay checkout verification data is incomplete." }, { status: 400 });
  }

  try {
    if (!verifyRazorpayCheckoutSignature(paymentId, subscriptionId, signature)) {
      return NextResponse.json({ error: "Razorpay checkout signature is invalid." }, { status: 400 });
    }

    const subscription = await razorpayRequest(
      `/subscriptions/${encodeURIComponent(subscriptionId)}`
    );
    if (subscription.notes?.dv_user_id !== user.id) {
      return NextResponse.json({ error: "This subscription does not belong to your account." }, { status: 403 });
    }

    const synced = await syncRazorpaySubscription(subscription, user.id);
    return NextResponse.json({
      success: true,
      planKey: synced.planKey,
      status: subscription.status,
    });
  } catch (error) {
    console.error("Razorpay checkout verification failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not verify your Razorpay payment." },
      { status: 503 }
    );
  }
}
