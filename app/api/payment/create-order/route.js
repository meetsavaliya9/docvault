import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getBillingSummary } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import {
  getSubscriptionPlanById,
  getUserSubscriptionPlan,
} from "@/lib/subscriptionPlans";
import { getRazorpayClient, getRazorpayCredentials } from "@/lib/razorpay";
import { hasPermission } from "@/lib/permissions";
import { logSafeServerError } from "@/lib/auth/errorDiagnostics";

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

  if (typeof body?.planId !== "string" || !body.planId.trim()) {
    return NextResponse.json({ error: "Choose a subscription plan." }, { status: 400 });
  }

  try {
    const plan = await getSubscriptionPlanById(body.planId, { activeOnly: true });
    if (!plan) {
      return NextResponse.json(
        { error: "This plan is unavailable. Refresh the page and choose an active plan." },
        { status: 404 }
      );
    }
    if (plan.slug === "free" || plan.price <= 0) {
      return NextResponse.json(
        { error: "Free plans do not require payment." },
        { status: 400 }
      );
    }

    const billing = await getBillingSummary(user.id);
    const current = await getUserSubscriptionPlan(user.id);
    if (
      billing.status === "active" &&
      billing.currency === plan.currency &&
      plan.price < current.plan.price
    ) {
      return NextResponse.json(
        { error: "You cannot switch to a lower plan before your current plan expires." },
        { status: 409 }
      );
    }

    const { keyId } = getRazorpayCredentials();
    const receipt = `dv_${randomUUID().replaceAll("-", "").slice(0, 30)}`;
    const order = await getRazorpayClient().orders.create({
      amount: plan.price,
      currency: plan.currency,
      receipt,
      notes: {
        docvault_user_id: user.id,
        docvault_plan_id: plan.id,
        docvault_plan_slug: plan.slug,
      },
    });

    if (
      typeof order.id !== "string" ||
      order.amount !== plan.price ||
      order.currency !== plan.currency
    ) {
      throw new Error("Razorpay returned an order that does not match the database plan.");
    }

    await prisma.payment.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        planId: plan.id,
        plan: plan.slug.toUpperCase(),
        planName: plan.name,
        billingPeriod: plan.billingPeriod,
        razorpayOrderId: order.id,
        amount: plan.price,
        amountPaid: plan.price,
        currency: plan.currency,
        status: "PENDING",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
        name: "DocVault",
        description: `${plan.name} ${plan.billingPeriod} plan`,
        prefill: { email: user.email, name: user.name || undefined },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logSafeServerError("Failed to create Razorpay order", error);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 503 }
    );
  }
}
