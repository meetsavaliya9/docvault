import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];

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
  const selectedStatus = url.searchParams.get("status")?.toUpperCase();
  const status = PAYMENT_STATUSES.includes(selectedStatus) ? selectedStatus : null;
  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { razorpayPaymentId: { contains: search } },
            { razorpayOrderId: { contains: search } },
            { planName: { contains: search } },
            { user: { is: { email: { contains: search } } } },
            { user: { is: { name: { contains: search } } } },
          ],
        }
      : {}),
  };

  try {
    const [payments, total] = await Promise.all([
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
          currency: true,
          status: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      payments: payments.map((payment) => ({
        ...payment,
        paymentId: payment.razorpayPaymentId || payment.razorpayOrderId,
        amount: payment.amountPaid || payment.amount,
        planName: payment.planName || payment.plan,
      })),
      total,
      page,
      pageSize,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin payment list fetch error:", error);
    return NextResponse.json({ error: "Could not load payments." }, { status: 500 });
  }
}
