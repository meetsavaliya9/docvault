import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
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
  const where = {
    ...(status === "blocked" ? { isBlocked: true } : status === "active" ? { isBlocked: false } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
            { id: { contains: search } },
          ],
        }
      : {}),
  };

  try {
    const [accounts, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          isBlocked: true,
          createdAt: true,
          _count: { select: { documents: true } },
          subscriptions: {
            where: {
              status: { in: ["active", "trialing"] },
              AND: [
                { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
                { OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              planKey: true,
              provider: true,
              status: true,
              endDate: true,
              currentPeriodEnd: true,
              plan: { select: { slug: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    const users = accounts.map((account) => {
      const subscription = account.subscriptions[0] || null;
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        isAdmin: isAdminEmail(account.email),
        isBlocked: account.isBlocked,
        createdAt: account.createdAt,
        documentCount: account._count.documents,
        subscription: {
          plan: (subscription?.plan?.slug || subscription?.planKey || "FREE").toLowerCase(),
          planName: subscription?.plan?.name || subscription?.planKey || "Free",
          status: subscription?.status || "free",
          provider: subscription?.provider || null,
          endDate: subscription?.endDate || subscription?.currentPeriodEnd || null,
        },
      };
    });

    return NextResponse.json({ users, total, page, pageSize }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin user list fetch error:", error);
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }
}
