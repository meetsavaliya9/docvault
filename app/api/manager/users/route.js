import { NextResponse } from "next/server";
import { getAdminEmails } from "@/lib/auth/admin";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { user, response } = await requireManagerPermission("VIEW_USERS");
    if (response) return response;
    if (!user) {
      return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
    }
    const canViewUserFiles = await hasPermission(user, "VIEW_USER_FILES");
    const canViewSubscriptions = await hasPermission(user, "VIEW_SUBSCRIPTIONS");

    const url = new URL(request.url);
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = 25;
    const adminEmails = getAdminEmails();
    const search = url.searchParams.get("search")?.trim();
    const requestedStatus = url.searchParams.get("status");
    const status = ["active", "blocked"].includes(requestedStatus)
      ? requestedStatus
      : "all";
    const sortFields = ["createdAt", "name", "email"];
    const requestedSort = url.searchParams.get("sort");
    const sort = sortFields.includes(requestedSort) ? requestedSort : "createdAt";
    const direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
    const searchFilter = search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : {};
    const where = {
      role: "USER",
      ...(status === "active" ? { isBlocked: false } : {}),
      ...(status === "blocked" ? { isBlocked: true } : {}),
      ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
      ...searchFilter,
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          isBlocked: true,
          createdAt: true,
          ...(canViewUserFiles
            ? { _count: { select: { documents: { where: { deleted: false } } } } }
            : {}),
          ...(canViewSubscriptions
            ? {
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
                  status: true,
                  planKey: true,
                  endDate: true,
                  currentPeriodEnd: true,
                  plan: { select: { slug: true, name: true } },
                },
                },
              }
            : {}),
        },
        orderBy: { [sort]: direction },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map(({ _count, subscriptions, ...account }) => {
        const subscription = subscriptions?.[0] || null;
        return {
          ...account,
          documentCount: canViewUserFiles ? _count.documents : null,
          status: account.isBlocked ? "blocked" : "active",
          subscription: canViewSubscriptions
            ? {
                plan: subscription?.plan?.name || subscription?.planKey || "Free",
                status: subscription?.status || "free",
                endDate: subscription?.endDate || subscription?.currentPeriodEnd || null,
              }
            : null,
        };
      }),
      total,
      page,
      pageSize,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Manager user directory fetch failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load users right now." },
      { status: 500 },
    );
  }
}
