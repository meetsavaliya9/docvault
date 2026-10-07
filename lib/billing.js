import { prisma } from "@/lib/prisma";
import { getUserSubscriptionPlan } from "@/lib/subscriptionPlans";

export const GIBIBYTE = 1024 ** 3;
export const GIBIBYTE_BYTES = GIBIBYTE;

export function formatStorageLimit(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[exponent]}`;
}

export class PlanLimitExceededError extends Error {
  constructor({ kind, plan, current, incoming, limit }) {
    const suggestion = plan.slug === "free" ? "Upgrade to a paid plan" : "Upgrade your plan";
    super(
      kind === "documents"
        ? `You have reached your ${plan.name} plan document limit. ${suggestion} for more documents.`
        : `You have reached your ${plan.name} plan storage limit. ${suggestion} for more storage.`
    );
    this.name = "PlanLimitExceededError";
    this.kind = kind;
    this.plan = plan.slug;
    this.current = current;
    this.incoming = incoming;
    this.limit = limit;
  }
}

export async function getBillingSummary(userId) {
  const [accountPlan, usage, documentCount, latestPayment] = await Promise.all([
    getUserSubscriptionPlan(userId),
    prisma.document.aggregate({
      where: { userId, deleted: false },
      _sum: { rawBytes: true },
    }),
    prisma.document.count({ where: { userId, deleted: false } }),
    prisma.payment.findFirst({
      where: { userId, status: { in: ["SUCCESS", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        planName: true,
        amountPaid: true,
        refundedAmount: true,
        currency: true,
        status: true,
        razorpayPaymentId: true,
        createdAt: true,
        subscription: { select: { startDate: true, endDate: true } },
      },
    }),
  ]);

  const { plan, subscription } = accountPlan;
  const usedBytes = Math.max(Number(usage._sum.rawBytes) || 0, 0);
  const expiry = subscription?.endDate || subscription?.currentPeriodEnd || null;
  const documentLimit = plan.documentLimit;

  return {
    plan: plan.slug,
    planName: plan.name,
    amount: plan.price,
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    provider: subscription?.provider || null,
    status: subscription ? "active" : "free",
    startDate: subscription?.startDate?.toISOString() || null,
    currentPeriodEnd: expiry?.toISOString() || null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    canManage: Boolean(subscription),
    quotaGB: plan.storageLimitBytes / GIBIBYTE,
    quotaBytes: plan.storageLimitBytes,
    quotaLabel: formatStorageLimit(plan.storageLimitBytes),
    maxDocuments: documentLimit,
    documentCount,
    usedBytes,
    latestPayment: latestPayment
      ? {
          plan: latestPayment.planName,
          amount: latestPayment.amountPaid,
          refundedAmount: latestPayment.refundedAmount,
          currency: latestPayment.currency,
          status: latestPayment.status.toLowerCase(),
          paymentId: latestPayment.razorpayPaymentId,
          paidAt: latestPayment.createdAt.toISOString(),
          startDate:
            latestPayment.subscription?.startDate?.toISOString() ||
            latestPayment.createdAt.toISOString(),
          endDate: latestPayment.subscription?.endDate?.toISOString() || null,
        }
      : null,
  };
}

export async function createDocumentWithinQuota(userId, data) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;

    const [accountPlan, usage, documentCount] = await Promise.all([
      getUserSubscriptionPlan(userId, { client: transaction }),
      transaction.document.aggregate({
        where: { userId, deleted: false },
        _sum: { rawBytes: true },
      }),
      transaction.document.count({ where: { userId, deleted: false } }),
    ]);
    const { plan } = accountPlan;
    const usedBytes = Math.max(Number(usage._sum.rawBytes) || 0, 0);
    const storageLimit = plan.storageLimitBytes;

    if (plan.documentLimit !== null && documentCount >= plan.documentLimit) {
      throw new PlanLimitExceededError({
        kind: "documents",
        plan,
        current: documentCount,
        incoming: 1,
        limit: plan.documentLimit,
      });
    }
    if (usedBytes + data.rawBytes > storageLimit) {
      throw new PlanLimitExceededError({
        kind: "storage",
        plan,
        current: usedBytes,
        incoming: data.rawBytes,
        limit: storageLimit,
      });
    }

    return transaction.document.create({ data });
  });
}
