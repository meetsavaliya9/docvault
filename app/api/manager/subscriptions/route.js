import { NextResponse } from "next/server";
import { getAdminEmails } from "@/lib/auth/admin";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "cancelled",
  "canceled",
  "expired",
  "refunded",
  "past_due",
  "pending",
];

function orderByFor(sort, direction) {
  if (sort === "status") return { status: direction };
  if (sort === "plan") return { planKey: direction };
  if (sort === "user") return { user: { name: direction } };
  return { createdAt: direction };
}

export async function GET(request) {
  const { response } = await requireManagerPermission("VIEW_SUBSCRIPTIONS");
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "25", 10) || 25));
  const search = url.searchParams.get("search")?.trim().slice(0, 100);
  const plan = url.searchParams.get("plan")?.trim().slice(0, 80);
  const requestedStatus = url.searchParams.get("status")?.toLowerCase();
  const status = SUBSCRIPTION_STATUSES.includes(requestedStatus) ? requestedStatus : null;
  const sort = ["status", "plan", "user"].includes(url.searchParams.get("sort"))
    ? url.searchParams.get("sort")
    : "createdAt";
  const direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
  const adminEmails = getAdminEmails();
  const now = new Date();
  const where = {
    user: {
      is: {
        role: "USER",
        ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
      },
    },
    ...(status === "expired"
      ? {
          status: { in: ["active", "trialing"] },
          AND: [
            {
              OR: [
                { endDate: { lte: now } },
                { currentPeriodEnd: { lte: now } },
              ],
            },
          ],
        }
      : status
        ? { status }
        : {}),
    ...(plan
      ? {
          OR: [
            { planKey: { contains: plan } },
            { plan: { is: { name: { contains: plan } } } },
          ],
        }
      : {}),
    ...(search
      ? {
          AND: [
            plan
              ? {
                  OR: [
                    { planKey: { contains: plan } },
                    { plan: { is: { name: { contains: plan } } } },
                  ],
                }
              : {},
            {
              OR: [
                { id: { contains: search } },
                { planKey: { contains: search } },
                { user: { is: { name: { contains: search } } } },
                { user: { is: { email: { contains: search } } } },
              ],
            },
          ],
        }
      : {}),
  };

  try {
    const [records, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        select: {
          id: true,
          provider: true,
          planKey: true,
          status: true,
          startDate: true,
          endDate: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { name: true } },
          payments: {
            where: { status: { in: ["SUCCESS", "REFUNDED"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { amountPaid: true, amount: true, currency: true },
          },
        },
        orderBy: orderByFor(sort, direction),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({
      subscriptions: records.map((record) => {
        const expiry = record.endDate || record.currentPeriodEnd;
        const isExpired =
          ["active", "trialing"].includes(record.status.toLowerCase()) &&
          [record.endDate, record.currentPeriodEnd].some(
            (date) => date && date <= now,
          );
        const payment = record.payments[0];
        return {
          id: record.id,
          provider: record.provider,
          planName: record.plan?.name || record.planKey || "Unknown",
          status: isExpired ? "expired" : record.status,
          startDate: record.startDate,
          endDate: expiry,
          cancelAtPeriodEnd: record.cancelAtPeriodEnd,
          createdAt: record.createdAt,
          user: record.user,
          amount: payment?.amountPaid || payment?.amount || 0,
          currency: payment?.currency || "INR",
        };
      }),
      total,
      page,
      pageSize,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Manager subscription list fetch failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load subscriptions right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
