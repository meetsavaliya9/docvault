import { NextResponse } from "next/server";
import { getAdminEmails, isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { getConfiguredManagerEmail } from "@/lib/managerConfig";
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
  const adminEmails = getAdminEmails();
  const managerEmail = getConfiguredManagerEmail();
  const where = {
    role: "USER",
    ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
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
    const [accounts, total, managers] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isBlocked: true,
          createdAt: true,
          managerAssignment: {
            select: {
              manager: { select: { id: true, name: true, email: true } },
            },
          },
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
      prisma.user.findMany({
        where: {
          role: "MANAGER",
          ...(managerEmail ? { email: managerEmail } : { id: "__manager_not_configured__" }),
          ...(managerEmail && isAdminEmail(managerEmail)
            ? { id: "__manager_not_configured__" }
            : {}),
        },
        select: { id: true, name: true, email: true, isBlocked: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const users = accounts.map((account) => {
      const subscription = account.subscriptions[0] || null;
      const isAdmin = account.role === "ADMIN" || isAdminEmail(account.email);
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        isAdmin,
        role: isAdmin ? "ADMIN" : account.role,
        manager: account.managerAssignment?.manager || null,
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

    return NextResponse.json({ users, total, page, pageSize, managers }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin user list fetch error:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json({ error: "Could not load users." }, { status: 500 });
  }
}
