import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { GIBIBYTE } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { user: adminUser, response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const selectedUserId = url.searchParams.get("userId");
  const documentsOnly = url.searchParams.get("documentsOnly") === "true";
  const chartPeriod = url.searchParams.get("chartPeriod") || "yearly";
  const chartPeriodConfig = {
    weekly: { count: 7, granularity: "day" },
    monthly: { count: 30, granularity: "day" },
    yearly: { count: 12, granularity: "month" },
  }[chartPeriod];

  if (!documentsOnly && !chartPeriodConfig) {
    return NextResponse.json(
      { error: "Chart period must be weekly, monthly, or yearly." },
      { status: 400 }
    );
  }

  try {
    if (documentsOnly) {
      const documents = await prisma.document.findMany({
        where: selectedUserId ? { userId: selectedUserId } : {},
        select: {
          id: true,
          userId: true,
          name: true,
          type: true,
          size: true,
          rawBytes: true,
          folder: true,
          starred: true,
          deleted: true,
          hash: true,
          cloudinaryPublicId: true,
          createdAt: true,
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: selectedUserId ? 100 : 200,
      });
      return NextResponse.json({ documents });
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const chartStart = chartPeriodConfig.granularity === "day"
      ? new Date(today.getTime() - (chartPeriodConfig.count - 1) * 24 * 60 * 60 * 1000)
      : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (chartPeriodConfig.count - 1), 1));
    const [
      accounts,
      storageByUser,
      allDocsMetrics,
      activeSubscriptions,
      configuredRazorpayPlans,
      configuredSubscriptionPlans,
      revenueTotals,
      recentPayments,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          isBlocked: true,
          createdAt: true,
          _count: { select: { documents: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.document.groupBy({
        by: ["userId"],
        _sum: { rawBytes: true },
      }),
      prisma.document.groupBy({
        by: ["type"],
        _sum: { rawBytes: true },
        _count: { _all: true },
      }),
      prisma.subscription.findMany({
        where: {
          status: { in: ["active", "trialing"] },
          AND: [
            { OR: [{ endDate: null }, { endDate: { gt: now } }] },
            { OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] },
          ],
        },
        select: {
          userId: true,
          provider: true,
          stripePriceId: true,
          planKey: true,
          planId: true,
          status: true,
          endDate: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.razorpayPlan.findMany({
        select: { providerPlanId: true, planKey: true },
      }),
      prisma.subscriptionPlan.findMany(),
      prisma.payment.groupBy({
        by: ["currency"],
        where: { status: "SUCCESS" },
        _sum: { amountPaid: true },
        _count: { _all: true },
      }),
      prisma.payment.findMany({
        where: { status: "SUCCESS", createdAt: { gte: chartStart } },
        select: { amountPaid: true, currency: true, createdAt: true },
      }),
    ]);

    const razorpayPlanById = new Map(
      configuredRazorpayPlans.map(({ providerPlanId, planKey }) => [
        providerPlanId,
        planKey,
      ])
    );
    const resolvePlanKey = (subscription) =>
      (subscription?.planId
        ? configuredSubscriptionPlans.find((plan) => plan.id === subscription.planId)?.slug.toLowerCase()
        : null) ||
      subscription?.planKey?.toLowerCase() ||
      razorpayPlanById.get(subscription?.stripePriceId);
    const planByKey = new Map(
      configuredSubscriptionPlans.map((plan) => [plan.slug.toLowerCase(), plan])
    );
    const freePlan = planByKey.get("free");

    const storageMap = new Map(
      storageByUser.map(({ userId, _sum }) => [userId, _sum.rawBytes || 0])
    );
    const subscriptionByUser = new Map();
    for (const subscription of activeSubscriptions) {
      if (!subscriptionByUser.has(subscription.userId)) {
        subscriptionByUser.set(subscription.userId, subscription);
      }
    }
    const nonAdminAccounts = accounts.filter((account) => !isAdminEmail(account.email));
    const planSubscriberCounts = new Map();
    for (const account of nonAdminAccounts) {
      const planKey = resolvePlanKey(subscriptionByUser.get(account.id)) || "free";
      planSubscriberCounts.set(planKey, (planSubscriberCounts.get(planKey) || 0) + 1);
    }

    const users = accounts.map((acc) => {
      const subscription = subscriptionByUser.get(acc.id);
      const planKey = resolvePlanKey(subscription) || "free";
      const plan = planByKey.get(planKey) || freePlan;
      return {
        id: acc.id,
        email: acc.email,
        isAdmin: isAdminEmail(acc.email),
        name: acc.name,
        isBlocked: acc.isBlocked,
        createdAt: acc.createdAt,
        documentCount: acc._count.documents,
        storageBytes: storageMap.get(acc.id) || 0,
        subscription: {
          plan: planKey,
          planName: plan?.name || "—",
          quotaGB: plan ? Number(plan.storageLimitBytes) / GIBIBYTE : 0,
          quotaLabel: plan
            ? `${(Number(plan.storageLimitBytes) / 1024 ** 2).toFixed(0)} MB`
            : "—",
          provider: subscription?.provider || null,
          status: subscription?.status || "free",
          currentPeriodEnd: subscription?.endDate || subscription?.currentPeriodEnd || null,
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        },
      };
    });

    let totalStorageBytes = 0;
    let pdfBytes = 0;
    let imgBytes = 0;
    let docBytes = 0;
    let otherBytes = 0;

    let documentCount = 0;
    for (const metric of allDocsMetrics) {
      const b = metric._sum.rawBytes || 0;
      documentCount += metric._count._all;
      totalStorageBytes += b;
      const t = (metric.type || "").toUpperCase();
      if (t === "PDF") pdfBytes += b;
      else if (["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG"].includes(t)) imgBytes += b;
      else if (["DOC", "DOCX", "TXT", "MD"].includes(t)) docBytes += b;
      else otherBytes += b;
    }

    let plusSubscribers = 0;
    let proSubscribers = 0;
    let razorpayPlusSubscribers = 0;
    let razorpayProSubscribers = 0;
    let demoSubscriptions = 0;
    let adminSubscriptions = 0;
    let paidSubscribers = 0;
    let estimatedMonthlyRevenueCents = 0;
    let estimatedMonthlyPlanValueCents = 0;
    for (const subscription of subscriptionByUser.values()) {
      const planKey = resolvePlanKey(subscription);
      if (planKey === "plus") plusSubscribers += 1;
      if (planKey === "pro") proSubscribers += 1;
      if (subscription.provider === "demo") demoSubscriptions += 1;
      if (subscription.provider === "admin") adminSubscriptions += 1;
      if (["razorpay", "stripe"].includes(subscription.provider) && planKey) {
        paidSubscribers += 1;
        if (subscription.provider === "razorpay" && planKey === "plus") razorpayPlusSubscribers += 1;
        if (subscription.provider === "razorpay" && planKey === "pro") razorpayProSubscribers += 1;
        const plan = planByKey.get(planKey);
        if (plan?.currency === "INR") {
          estimatedMonthlyRevenueCents += plan.price;
        }
      }
      if (planKey) {
        const plan = planByKey.get(planKey);
        if (plan?.currency === "INR") {
          estimatedMonthlyPlanValueCents += plan.price;
        }
      }
    }

    const chartBuckets = Array.from({ length: chartPeriodConfig.count }, (_, index) => {
      const bucketDate = chartPeriodConfig.granularity === "day"
        ? new Date(chartStart.getTime() + index * 24 * 60 * 60 * 1000)
        : new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + index, 1));
      const key = chartPeriodConfig.granularity === "day"
        ? `${bucketDate.getUTCFullYear()}-${String(bucketDate.getUTCMonth() + 1).padStart(2, "0")}-${String(bucketDate.getUTCDate()).padStart(2, "0")}`
        : `${bucketDate.getUTCFullYear()}-${String(bucketDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = chartPeriodConfig.granularity === "day"
        ? chartPeriod === "weekly"
          ? new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(bucketDate)
          : String(bucketDate.getUTCDate())
        : new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(bucketDate);
      return { key, label };
    });
    const getBucketKey = (date) => chartPeriodConfig.granularity === "day"
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
      : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const revenueAmountsByBucket = new Map();
    for (const payment of recentPayments) {
      const key = getBucketKey(payment.createdAt);
      const amounts = revenueAmountsByBucket.get(key) || {};
      amounts[payment.currency] = (amounts[payment.currency] || 0) + payment.amountPaid;
      revenueAmountsByBucket.set(key, amounts);
    }
    const userCountsByBucket = new Map();
    for (const account of nonAdminAccounts) {
      if (account.createdAt < chartStart) continue;
      const key = getBucketKey(account.createdAt);
      userCountsByBucket.set(key, (userCountsByBucket.get(key) || 0) + 1);
    }
    const revenueByPeriod = chartBuckets.map(({ key, label }) => ({
      month: key,
      label,
      amounts: revenueAmountsByBucket.get(key) || {},
    }));
    const userGrowth = chartBuckets.map(({ key, label }) => ({
      month: key,
      label,
      count: userCountsByBucket.get(key) || 0,
    }));
    const revenueByCurrency = revenueTotals
      .map(({ currency, _sum, _count }) => ({
        currency,
        amount: _sum.amountPaid || 0,
        paymentCount: _count._all,
      }))
      .sort((left, right) => right.amount - left.amount);

    const paidPlanKeys = new Set(
      configuredSubscriptionPlans
        .filter((plan) => plan.price > 0)
        .map((plan) => plan.slug.toLowerCase())
    );
    const planSubscribers = Array.from(planSubscriberCounts.entries()).reduce(
      (total, [planKey, count]) => total + (paidPlanKeys.has(planKey) ? count : 0),
      0
    );
    const summary = {
      userCount: nonAdminAccounts.length,
      documentCount,
      storageBytes: totalStorageBytes,
      activeSubscriptions: planSubscribers,
      revenueByCurrency,
      revenueByPeriod,
      userGrowth,
      chartPeriod,
      subscriptionMetrics: {
        freeAccounts: planSubscriberCounts.get("free") || 0,
        plusSubscribers,
        proSubscribers,
        planSubscribers,
        planDistribution: configuredSubscriptionPlans.map((plan) => ({
          key: plan.slug.toLowerCase(),
          name: plan.name,
          subscribers: planSubscriberCounts.get(plan.slug.toLowerCase()) || 0,
        })),
        razorpayPlusSubscribers,
        razorpayProSubscribers,
        paidSubscribers,
        demoSubscriptions,
        adminSubscriptions,
        estimatedMonthlyRevenueCents,
        estimatedMonthlyPlanValueCents,
        currency: "INR",
      },
      storageByType: {
        pdfBytes,
        imgBytes,
        docBytes,
        otherBytes,
      },
    };

    return NextResponse.json({
      admin: { id: adminUser.id, email: adminUser.email },
      summary,
      users,
      documents: [],
    });
  } catch (error) {
    console.error("Admin overview fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch administrative data." },
      { status: 500 }
    );
  }
}
