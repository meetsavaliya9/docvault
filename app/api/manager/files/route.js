import { NextResponse } from "next/server";
import { getAdminEmails } from "@/lib/auth/admin";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { user: manager, response } = await requireManagerPermission("VIEW_USER_FILES");
    if (response) return response;

    const url = new URL(request.url);
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = 25;
    const adminEmails = getAdminEmails();
    const search = url.searchParams.get("search")?.trim();
    const selectedUserId = url.searchParams.get("userId")?.trim();
    const selectedType = url.searchParams.get("type")?.trim().slice(0, 40);
    const owner = url.searchParams.get("owner")?.trim();
    const sortableFields = ["createdAt", "name", "type", "rawBytes"];
    const requestedSort = url.searchParams.get("sort");
    const sort = sortableFields.includes(requestedSort) ? requestedSort : "createdAt";
    const direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
    const where = {
      deleted: false,
      user: {
        is: {
          role: "USER",
          ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
          ...(selectedUserId ? { id: selectedUserId } : {}),
          ...(owner
            ? {
                OR: [
                  { name: { contains: owner } },
                  { email: { contains: owner } },
                ],
              }
            : {}),
        },
      },
      ...(selectedType ? { type: selectedType } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { type: { contains: search } },
              {
                user: {
                  is: {
                    OR: [
                      { name: { contains: search } },
                      { email: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const typeWhere = {
        deleted: false,
        user: {
          is: {
            role: "USER",
            ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
          },
        },
    };
    const [documents, total, types] = await Promise.all([
        prisma.document.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          rawBytes: true,
          folder: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { [sort]: direction },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where }),
      prisma.document.groupBy({
        by: ["type"],
        where: typeWhere,
        orderBy: { type: "asc" },
      }),
    ]);

    return NextResponse.json({
      documents,
      total,
      page,
      pageSize,
      types: types.map(({ type }) => type).filter(Boolean),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Manager files fetch failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load files right now." },
      { status: 500 },
    );
  }
}
