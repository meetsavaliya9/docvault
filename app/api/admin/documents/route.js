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
  const type = url.searchParams.get("type")?.trim().toUpperCase();
  const where = {
    ...(status === "trash" ? { deleted: true } : status === "active" ? { deleted: false } : {}),
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { user: { is: { email: { contains: search } } } },
            { user: { is: { name: { contains: search } } } },
          ],
        }
      : {}),
  };

  try {
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          rawBytes: true,
          deleted: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.document.count({ where }),
    ]);

    return NextResponse.json({ documents, total, page, pageSize }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin document list fetch error:", error);
    return NextResponse.json({ error: "Could not load documents." }, { status: 500 });
  }
}
