import { NextResponse } from "next/server";
import {
  activateVerifiedPayment,
  markPaymentFailed,
  recordProcessedRazorpayRefund,
} from "@/lib/payments";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Webhook signature is missing." }, { status: 400 });
  }

  try {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }
  } catch (error) {
    console.error("Razorpay payment webhook configuration error:", error);
    return NextResponse.json(
      { error: "Razorpay webhook is not configured on the server." },
      { status: 503 }
    );
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Webhook body is not valid JSON." }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  if (event.event === "refund.processed") {
    const refund = event.payload?.refund?.entity;
    if (!refund?.id || !refund?.payment_id || refund.status !== "processed") {
      return NextResponse.json({ error: "Processed refund event is incomplete." }, { status: 400 });
    }

    try {
      const result = await recordProcessedRazorpayRefund(refund);
      return NextResponse.json({ received: true, ...result });
    } catch (error) {
      console.error("Could not process Razorpay refund:", error);
      return NextResponse.json(
        { error: "Could not process the refund event. Razorpay can safely retry it." },
        { status: 500 }
      );
    }
  }

  if (event.event === "payment.failed") {
    if (!payment?.order_id || !payment?.id) {
      return NextResponse.json({ error: "Payment failure event is incomplete." }, { status: 400 });
    }
    try {
      await markPaymentFailed(payment.order_id, payment.id);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Could not record failed Razorpay payment:", error);
      return NextResponse.json({ error: "Could not process the payment event." }, { status: 500 });
    }
  }

  if (event.event !== "payment.captured") {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (!payment?.order_id || !payment?.id || payment.status !== "captured") {
    return NextResponse.json({ error: "Captured payment event is incomplete." }, { status: 400 });
  }

  try {
    const pending = await prisma.payment.findUnique({
      where: { razorpayOrderId: payment.order_id },
      select: { amountPaid: true, currency: true },
    });
    if (!pending) {
      return NextResponse.json({ error: "Payment order was not found." }, { status: 404 });
    }
    if (pending.amountPaid !== payment.amount || pending.currency !== payment.currency) {
      return NextResponse.json({ error: "Payment details do not match the order." }, { status: 400 });
    }
    await activateVerifiedPayment({
      orderId: payment.order_id,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Could not process captured Razorpay payment:", error);
    return NextResponse.json(
      { error: "Could not process the payment event. Razorpay can safely retry it." },
      { status: 500 }
    );
  }
}
