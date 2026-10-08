import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { razorpayRequest } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }
  if (!(await hasPermission(user, "VIEW_SUBSCRIPTION"))) {
    return NextResponse.json({ error: "You do not have permission to manage subscriptions." }, { status: 403 });
  }

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: { in: ["active", "trialing"] },
      },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    const subscription = subscriptions.find((candidate) => {
      const plan = candidate.planKey?.toLowerCase();
      const expiry = candidate.endDate || candidate.currentPeriodEnd;
      return (
        plan !== "free" &&
        (!expiry || expiry > now) &&
        (candidate.planKey || candidate.stripePriceId)
      );
    });
    if (!subscription) {
      return NextResponse.json({ error: "No active Razorpay subscription was found." }, { status: 404 });
    }
    if (subscription.cancelAtPeriodEnd) {
      return NextResponse.json({
        success: true,
        message: "Your subscription is already scheduled to cancel at the end of this billing period.",
      });
    }

    const cancelled = subscription.stripeSubscriptionId
      ? await razorpayRequest(
          `/subscriptions/${encodeURIComponent(subscription.stripeSubscriptionId)}/cancel`,
          { method: "POST", body: { cancel_at_cycle_end: true } }
        )
      : null;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        ...(Number.isFinite(cancelled?.current_end)
          ? { currentPeriodEnd: new Date(cancelled.current_end * 1000) }
          : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Your plan remains active until the end of this billing period, then your account returns to Free.",
    });
  } catch (error) {
    console.error("Failed to schedule Razorpay subscription cancellation:", error);
    return NextResponse.json(
      { error: error.message || "Could not cancel the Razorpay subscription." },
      { status: 503 }
    );
  }
}
