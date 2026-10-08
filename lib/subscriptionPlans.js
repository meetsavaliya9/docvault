import "server-only";
import { prisma } from "@/lib/prisma";
import { parseJsonText, stringifyJsonText } from "@/lib/jsonText";

export const BILLING_PERIODS = ["monthly", "yearly"];
export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

export function serializeSubscriptionPlan(plan) {
  const features = parseJsonText(plan.features, []);
  return {
    id: plan.id,
    slug: plan.slug.toLowerCase(),
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    razorpayPlanId: plan.razorpayPlanId || null,
    description: plan.description,
    features: Array.isArray(features) ? features : [],
    documentLimit: plan.documentLimit,
    storageLimitBytes: Number(plan.storageLimitBytes),
    isActive: plan.isActive,
    isRecommended: plan.isRecommended,
    displayOrder: plan.displayOrder,
    createdAt: plan.createdAt?.toISOString(),
    updatedAt: plan.updatedAt?.toISOString(),
  };
}

export async function listSubscriptionPlans({ activeOnly = false, client = prisma } = {}) {
  const plans = await client.subscriptionPlan.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return plans.map(serializeSubscriptionPlan);
}

export async function getSubscriptionPlanById(id, { client = prisma, activeOnly = false } = {}) {
  if (typeof id !== "string" || !id.trim()) return null;
  const plan = await client.subscriptionPlan.findUnique({
    where: { id: id.trim() },
  });
  if (!plan || (activeOnly && !plan.isActive)) return null;
  return serializeSubscriptionPlan(plan);
}

async function resolveLegacyPlan(client, subscription) {
  if (subscription.plan) return subscription.plan;

  const planKey = subscription.planKey;
  if (planKey) {
    return client.subscriptionPlan.findUnique({ where: { slug: planKey } });
  }
  if (!subscription.stripePriceId) return null;

  const razorpayPlan = await client.razorpayPlan.findUnique({
    where: { providerPlanId: subscription.stripePriceId },
    select: { planKey: true },
  });
  if (razorpayPlan?.planKey) {
    return client.subscriptionPlan.findUnique({
      where: { slug: razorpayPlan.planKey },
    });
  }
  const legacyPlanKey =
    (subscription.stripePriceId === "admin_plus" ||
    subscription.stripePriceId === "demo_plus_monthly" ||
    subscription.stripePriceId === process.env.STRIPE_PLUS_MONTHLY_PRICE_ID
      ? "PLUS"
      : subscription.stripePriceId === "admin_pro" ||
          subscription.stripePriceId === "demo_pro_monthly" ||
          subscription.stripePriceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID
        ? "PRO"
        : null);
  return legacyPlanKey
    ? client.subscriptionPlan.findUnique({
        where: { slug: legacyPlanKey.toUpperCase() },
      })
    : null;
}

export async function getUserSubscriptionPlan(userId, { client = prisma, now = new Date() } = {}) {
  const subscriptions = await client.subscription.findMany({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
      OR: [
        { endDate: null, currentPeriodEnd: null },
        { endDate: { gt: now } },
        { endDate: null, currentPeriodEnd: { gt: now } },
      ],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  for (const subscription of subscriptions) {
    const plan = await resolveLegacyPlan(client, subscription);
    if (plan) return { subscription, plan: serializeSubscriptionPlan(plan) };
  }

  let freePlan = await client.subscriptionPlan.findFirst({
    where: {
      OR: [
        { slug: "FREE" },
        { slug: "free" },
        { id: "FREE" },
      ],
    },
  });
  if (!freePlan) {
    try {
      freePlan = await client.subscriptionPlan.upsert({
        where: { slug: "FREE" },
        create: {
          id: "FREE",
          slug: "FREE",
          name: "Free",
          price: 0,
          currency: "INR",
          billingPeriod: "monthly",
          description: "A simple start for your personal document vault.",
          features: stringifyJsonText(["Basic document search", "Upload documents", "Delete documents"]),
          documentLimit: 10,
          storageLimitBytes: BigInt(100 * 1024 ** 2),
          isActive: true,
          isRecommended: false,
          displayOrder: 0,
        },
        update: {},
      });
    } catch {
      // Fallback in-memory object if database write fails in read-only transaction
      return {
        subscription: null,
        plan: {
          id: "FREE",
          slug: "free",
          name: "Free",
          price: 0,
          currency: "INR",
          billingPeriod: "monthly",
          razorpayPlanId: null,
          description: "A simple start for your personal document vault.",
          features: ["Basic document search", "Upload documents", "Delete documents"],
          documentLimit: 10,
          storageLimitBytes: 100 * 1024 ** 2,
          isActive: true,
          isRecommended: false,
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    }
  }
  return { subscription: null, plan: serializeSubscriptionPlan(freePlan) };
}
