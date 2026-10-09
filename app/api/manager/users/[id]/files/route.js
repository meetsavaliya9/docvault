import { NextResponse } from "next/server";
import { getAdminEmails } from "@/lib/auth/admin";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const { response } = await requireManagerPermission("VIEW_USER_FILES");
    if (response) return response;

    const { id } = await params;
    const url = new URL(request.url);
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = 25;
    const adminEmails = getAdminEmails();
    const account = await prisma.user.findFirst({
      where: {
        id,
        role: "USER",
        ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const documentsWhere = { userId: account.id, deleted: false };
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: documentsWhere,
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          rawBytes: true,
          folder: true,
          modified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where: documentsWhere }),
    ]);

    return NextResponse.json({
      user: { ...account, documents },
      total,
      page,
      pageSize,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Manager user files fetch failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load this user's files right now." },
      { status: 500 },
    );
  }
}
