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

    const [
      accounts,
      storageByUser,
      allDocsMetrics,
      activeSubscriptions,
      configuredRazorpayPlans,
      configuredSubscriptionPlans,
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
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
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

    const summary = {
      userCount: accounts.length,
      documentCount,
      storageBytes: totalStorageBytes,
      subscriptionMetrics: {
        freeAccounts: Math.max(accounts.length - plusSubscribers - proSubscribers, 0),
        plusSubscribers,
        proSubscribers,
        planSubscribers: plusSubscribers + proSubscribers,
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
