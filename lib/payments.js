import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

function getSubscriptionEnd(startDate, billingPeriod) {
  const endDate = new Date(startDate);
  if (billingPeriod === "yearly") {
    endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
    return endDate;
  }
  const dayOfMonth = endDate.getUTCDate();
  endDate.setUTCDate(1);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const lastDayOfMonth = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  endDate.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
  return endDate;
}

export async function activateVerifiedPayment({
  orderId,
  paymentId,
  signature = null,
  amount,
  currency,
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM Payment WHERE razorpayOrderId = ${orderId} FOR UPDATE
    `;
    const payment = await transaction.payment.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (!payment) throw new Error("The payment order was not found.");
    if (
      payment.amountPaid !== amount ||
      payment.currency !== currency ||
      payment.status === "REFUNDED" ||
      (payment.status === "SUCCESS" &&
        payment.razorpayPaymentId !== paymentId)
    ) {
      throw new Error("The payment details do not match an eligible payment order.");
    }
    if (payment.status === "SUCCESS") {
      if (signature && !payment.razorpaySignature) {
        return transaction.payment.update({
          where: { id: payment.id },
          data: { razorpaySignature: signature },
        });
      }
      return payment;
    }

    const now = new Date();
    const endDate = getSubscriptionEnd(now, payment.billingPeriod);
    const subscription = await transaction.subscription.create({
      data: {
        id: randomUUID(),
        userId: payment.userId,
        provider: "razorpay",
        planKey: payment.plan,
        planId: payment.planId,
        status: "active",
        startDate: now,
        endDate,
        currentPeriodEnd: endDate,
        updatedAt: now,
      },
    });

    return transaction.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        amountPaid: amount,
        status: "SUCCESS",
        subscriptionId: subscription.id,
      },
    });
  });
}

export async function markPaymentFailed(orderId, paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: orderId },
    select: { id: true, status: true, razorpayPaymentId: true },
  });
  if (!payment || payment.status !== "PENDING") return;
  if (payment.razorpayPaymentId && payment.razorpayPaymentId !== paymentId) return;
  await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "FAILED", razorpayPaymentId: paymentId },
  });
}

export async function recordProcessedRazorpayRefund(refund) {
  if (
    typeof refund?.id !== "string" ||
    typeof refund.payment_id !== "string" ||
    !Number.isSafeInteger(refund.amount) ||
    refund.amount <= 0 ||
    typeof refund.currency !== "string"
  ) {
    throw new Error("The Razorpay refund details are incomplete.");
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM Payment WHERE razorpayPaymentId = ${refund.payment_id} FOR UPDATE
    `;
    const payment = await transaction.payment.findUnique({
      where: { razorpayPaymentId: refund.payment_id },
    });
    if (!payment) throw new Error("The payment for this Razorpay refund was not found.");

    const paidAmount = payment.amountPaid || payment.amount;
    if (
      payment.currency !== refund.currency ||
      refund.amount > paidAmount
    ) {
      throw new Error("The Razorpay refund does not match the recorded payment.");
    }

    const existingRefund = await transaction.paymentRefund.findUnique({
      where: { razorpayRefundId: refund.id },
    });
    if (
      existingRefund &&
      (existingRefund.paymentId !== payment.id ||
        existingRefund.amount !== refund.amount ||
        existingRefund.currency !== refund.currency)
    ) {
      throw new Error("The Razorpay refund ID conflicts with an existing refund.");
    }

    await transaction.paymentRefund.upsert({
      where: { razorpayRefundId: refund.id },
      create: {
        razorpayRefundId: refund.id,
        paymentId: payment.id,
        amount: refund.amount,
        currency: refund.currency,
        status: "processed",
        processedAt: new Date(),
      },
      update: {
        status: "processed",
        processedAt: new Date(),
      },
    });

    const refunds = await transaction.paymentRefund.aggregate({
      where: { paymentId: payment.id, status: "processed" },
      _sum: { amount: true },
    });
    const refundedAmount = refunds._sum.amount || 0;
    if (refundedAmount > paidAmount) {
      throw new Error("Processed refunds exceed the recorded payment amount.");
    }

    const fullyRefunded = refundedAmount === paidAmount;
    await transaction.payment.update({
      where: { id: payment.id },
      data: {
        amountPaid: paidAmount,
        refundedAmount,
        ...(fullyRefunded ? { status: "REFUNDED" } : {}),
      },
    });

    if (fullyRefunded && payment.subscriptionId) {
      await transaction.subscription.updateMany({
        where: { id: payment.subscriptionId, userId: payment.userId },
        data: {
          status: "refunded",
          endDate: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      });
    }

    return { refundedAmount, paidAmount, fullyRefunded };
  });
}
