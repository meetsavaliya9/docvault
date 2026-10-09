import { NextResponse } from "next/server";
import { getAdminEmails } from "@/lib/auth/admin";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];

function orderByFor(sort, direction) {
  if (sort === "amount") return { amountPaid: direction };
  if (sort === "status") return { status: direction };
  if (sort === "plan") return { planName: direction };
  if (sort === "user") return { user: { name: direction } };
  return { createdAt: direction };
}

export async function GET(request) {
  const { response } = await requireManagerPermission("VIEW_PAYMENTS");
  if (response) return response;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "25", 10) || 25));
  const search = url.searchParams.get("search")?.trim().slice(0, 100);
  const plan = url.searchParams.get("plan")?.trim().slice(0, 80);
  const requestedStatus = url.searchParams.get("status")?.toUpperCase();
  const status = PAYMENT_STATUSES.includes(requestedStatus) ? requestedStatus : null;
  const sort = ["amount", "status", "plan", "user"].includes(url.searchParams.get("sort"))
    ? url.searchParams.get("sort")
    : "createdAt";
  const direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
  const adminEmails = getAdminEmails();
  const userScope = {
    role: "USER",
    ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
  };
  const where = {
    user: { is: userScope },
    ...(status ? { status } : {}),
    ...(plan
      ? {
          OR: [
            { planName: { contains: plan } },
            { plan: { contains: plan } },
          ],
        }
      : {}),
    ...(search
      ? {
          AND: [
            plan
              ? {
                  OR: [
                    { planName: { contains: plan } },
                    { plan: { contains: plan } },
                  ],
                }
              : {},
            {
              OR: [
                { razorpayPaymentId: { contains: search } },
                { razorpayOrderId: { contains: search } },
                { planName: { contains: search } },
                { plan: { contains: search } },
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
      prisma.payment.findMany({
        where,
        select: {
          id: true,
          razorpayPaymentId: true,
          razorpayOrderId: true,
          plan: true,
          planName: true,
          amount: true,
          amountPaid: true,
          refundedAmount: true,
          currency: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          subscription: {
            select: {
              id: true,
              status: true,
              planKey: true,
              endDate: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
        },
        orderBy: orderByFor(sort, direction),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments: records.map((record) => ({
        id: record.id,
        paymentId: record.razorpayPaymentId || record.razorpayOrderId,
        planName: record.planName || record.plan,
        amount: record.amountPaid || record.amount,
        amountPaid: record.amountPaid,
        refundedAmount: record.refundedAmount,
        currency: record.currency,
        status: record.status,
        createdAt: record.createdAt,
        user: record.user,
        subscription: record.subscription
          ? {
              id: record.subscription.id,
              status: record.subscription.status,
              plan: record.subscription.plan?.name || record.subscription.planKey,
              endDate: record.subscription.endDate || record.subscription.currentPeriodEnd,
            }
          : null,
      })),
      total,
      page,
      pageSize,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Manager payment list fetch failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load payments right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
