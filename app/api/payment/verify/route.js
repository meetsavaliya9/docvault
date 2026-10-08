import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { activateVerifiedPayment } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getSubscriptionPlanById } from "@/lib/subscriptionPlans";
import { getRazorpayClient, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
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

  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json(
      { error: "Payment verification details are incomplete." },
      { status: 400 }
    );
  }

  try {
    if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature)) {
      return NextResponse.json(
        { error: "Payment Failed. Your subscription has not been activated." },
        { status: 400 }
      );
    }

    const pending = await prisma.payment.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (!pending || pending.userId !== user.id) {
      return NextResponse.json(
        { error: "This payment order does not belong to your account." },
        { status: 404 }
      );
    }

    const client = getRazorpayClient();
    const [order, payment] = await Promise.all([
      client.orders.fetch(orderId),
      client.payments.fetch(paymentId),
    ]);
    if (
      order.id !== pending.razorpayOrderId ||
      order.status !== "paid" ||
      order.amount !== pending.amountPaid ||
      order.currency !== pending.currency ||
      order.notes?.docvault_user_id !== user.id ||
      order.notes?.docvault_plan_id !== pending.planId ||
      order.notes?.docvault_plan_slug !== pending.plan.toLowerCase() ||
      payment.order_id !== orderId ||
      payment.amount !== pending.amountPaid ||
      payment.currency !== pending.currency
    ) {
      return NextResponse.json(
        { error: "Payment Failed. Your subscription has not been activated." },
        { status: 400 }
      );
    }
    if (payment.status !== "captured" || payment.captured !== true) {
      if (payment.status === "failed") {
        await prisma.payment.updateMany({
          where: { id: pending.id, status: "PENDING" },
          data: { status: "FAILED", razorpayPaymentId: paymentId },
        });
      }
      return NextResponse.json(
        { error: "Payment is not captured. Your subscription has not been activated." },
        { status: 400 }
      );
    }

    const savedPayment = await activateVerifiedPayment({
      orderId,
      paymentId,
      signature,
      amount: payment.amount,
      currency: payment.currency,
    });
    const plan = await getSubscriptionPlanById(savedPayment.planId);
    const subscription = await prisma.subscription.findUnique({
      where: { id: savedPayment.subscriptionId },
      select: { startDate: true, endDate: true },
    });

    return NextResponse.json(
      {
        success: true,
        plan: savedPayment.plan.toLowerCase(),
        planName: savedPayment.planName || plan.name,
        amount: savedPayment.amountPaid,
        currency: savedPayment.currency,
        paymentId: savedPayment.razorpayPaymentId,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Razorpay payment verification failed:", error);
    return NextResponse.json(
      { error: "Payment verification failed. Your subscription has not been activated." },
      { status: 400 }
    );
  }
}
