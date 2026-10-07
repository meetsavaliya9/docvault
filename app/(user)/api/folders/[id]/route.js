import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function PATCH(request, { params }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    // Find folder by id or slug belonging to user
    const existing = await prisma.folder.findFirst({
      where: {
        userId: user.id,
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Folder not found." },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const currentData = existing.data || {};
    const updatedData = {
      ...currentData,
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() } : {}),
      ...(body.color ? { color: body.color } : {}),
      ...(body.bgLight ? { bgLight: body.bgLight } : {}),
      ...(body.textColor ? { textColor: body.textColor } : {}),
      ...(body.borderColor ? { borderColor: body.borderColor } : {}),
    };

    const updated = await prisma.folder.update({
      where: { id: existing.id },
      data: { data: updatedData },
    });

    return NextResponse.json(
      { folder: updated.data },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to update folder:", error);
    return NextResponse.json(
      { error: "Could not update folder." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(_request, { params }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const { id } = await params;
  try {
    const existing = await prisma.folder.findFirst({
      where: {
        userId: user.id,
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Folder not found." },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    await prisma.$transaction([
      prisma.folder.deleteMany({
        where: { id: existing.id, userId: user.id },
      }),
      prisma.document.updateMany({
        where: {
          userId: user.id,
          OR: [
            { folderSlug: existing.slug },
            { folder: typeof existing.data?.name === "string" ? existing.data.name : "" },
          ],
        },
        data: {
          folder: "General",
          folderSlug: "general",
        },
      }),
    ]);

    return NextResponse.json(
      { success: true },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to delete folder:", error);
    return NextResponse.json(
      { error: "Could not delete folder." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
