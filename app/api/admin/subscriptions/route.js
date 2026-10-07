import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "25", 10) || 25)
  );
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status");
  const plan = url.searchParams.get("plan")?.trim();
  const now = new Date();
  const searchTerms = search
    ? [
        { user: { is: { email: { contains: search } } } },
        { user: { is: { name: { contains: search } } } },
        { stripeSubscriptionId: { contains: search } },
        { planKey: search.toUpperCase() },
      ]
    : [];
  const where = {
    ...(status === "expired"
      ? {
          status: { in: ["active", "trialing"] },
          AND: [{
            OR: [
              { endDate: { lte: now } },
              { currentPeriodEnd: { lte: now } },
            ],
          }],
        }
      : status && status !== "all"
        ? { status }
        : {}),
    ...(plan ? { planKey: plan } : {}),
    ...(search ? { OR: searchTerms } : {}),
  };

  try {
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        select: {
          id: true,
          provider: true,
          stripeSubscriptionId: true,
          planKey: true,
          status: true,
          startDate: true,
          endDate: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { slug: true, name: true } },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { amount: true, amountPaid: true, currency: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({
      subscriptions: subscriptions.map((subscription) => {
        const expiry = subscription.endDate || subscription.currentPeriodEnd;
        const isExpired = ["active", "trialing"].includes(subscription.status.toLowerCase()) &&
          expiry && expiry <= now;
        return {
          ...subscription,
          status: isExpired ? "expired" : subscription.status,
          planKey: subscription.plan?.slug || subscription.planKey || "FREE",
          planName: subscription.plan?.name || subscription.planKey || "Free",
          amount: subscription.payments[0]?.amountPaid || subscription.payments[0]?.amount || 0,
          currency: subscription.payments[0]?.currency || "INR",
        };
      }),
      total,
      page,
      pageSize,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin subscription list fetch error:", error);
    return NextResponse.json({ error: "Could not load subscriptions." }, { status: 500 });
  }
}
