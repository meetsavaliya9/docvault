import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { parseJsonText, stringifyJsonText } from "@/lib/jsonText";

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
  if (!(await hasPermission(user, "VIEW_FOLDERS"))) {
    return NextResponse.json({ error: "You do not have permission to view folders." }, { status: 403, headers: NO_CACHE_HEADERS });
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  if (!(await hasPermission(user, "RENAME_FOLDER"))) {
    return NextResponse.json({ error: "You do not have permission to rename folders." }, { status: 403, headers: NO_CACHE_HEADERS });
  }
  if (Object.hasOwn(body, "name") && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 255)) {
    return NextResponse.json(
      { error: "Folder names must contain 1 to 255 characters." },
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

    const currentData = parseJsonText(existing.data, {});
    const updatedData = {
      ...currentData,
      id: currentData.id || existing.id,
      slug: existing.slug,
      ...(Object.hasOwn(body, "name") ? { name: body.name.trim() } : {}),
      ...(typeof body.description === "string" ? { description: body.description.trim().slice(0, 500) } : {}),
      ...(typeof body.color === "string" ? { color: body.color } : {}),
      ...(typeof body.bgLight === "string" ? { bgLight: body.bgLight } : {}),
      ...(typeof body.textColor === "string" ? { textColor: body.textColor } : {}),
      ...(typeof body.borderColor === "string" ? { borderColor: body.borderColor } : {}),
    };

    await prisma.$transaction(async (transaction) => {
      await transaction.folder.update({
        where: { id: existing.id },
        data: { data: stringifyJsonText(updatedData) },
      });

      if (typeof currentData.name === "string" && updatedData.name !== currentData.name) {
        await transaction.document.updateMany({
          where: {
            userId: user.id,
            OR: [
              { folderSlug: existing.slug },
              { folder: currentData.name },
            ],
          },
          data: { folder: updatedData.name },
        });

        const trashItems = await transaction.trashItem.findMany({
          where: { userId: user.id },
          select: { id: true, data: true },
        });
        for (const trashItem of trashItems) {
          const item = parseJsonText(trashItem.data, {});
          const originalDoc = item?.originalDoc;
          if (!originalDoc) continue;
          const matchesFolder =
            originalDoc.folderSlug === existing.slug ||
            originalDoc.folder === currentData.name ||
            item.originalFolderSlug === existing.slug ||
            item.originalFolderName === currentData.name;
          if (!matchesFolder) continue;

          const updatedItem = {
            ...item,
            ...(item.originalFolder === currentData.name
              ? { originalFolder: updatedData.name }
              : {}),
            ...(item.originalFolderName === currentData.name ? { originalFolderName: updatedData.name } : {}),
            originalDoc: {
              ...originalDoc,
              folder: updatedData.name,
              folderSlug: existing.slug,
            },
          };
          await transaction.trashItem.updateMany({
            where: { id: trashItem.id, userId: user.id },
            data: { data: stringifyJsonText(updatedItem) },
          });
        }
      }
    });

    return NextResponse.json(
      { folder: updatedData },
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
  if (!(await hasPermission(user, "DELETE_FOLDER"))) {
    return NextResponse.json({ error: "You do not have permission to delete folders." }, { status: 403, headers: NO_CACHE_HEADERS });
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

    const currentData = parseJsonText(existing.data, {});
    await prisma.$transaction(async (transaction) => {
      await transaction.folder.deleteMany({
        where: { id: existing.id, userId: user.id },
      });
      await transaction.document.updateMany({
        where: {
          userId: user.id,
          OR: [
            { folderSlug: existing.slug },
            ...(typeof currentData.name === "string" ? [{ folder: currentData.name }] : []),
          ],
        },
        data: {
          folder: "General",
          folderSlug: "general",
        },
      });
      const trashItems = await transaction.trashItem.findMany({
        where: { userId: user.id },
        select: { id: true, data: true },
      });
      for (const trashItem of trashItems) {
        const item = parseJsonText(trashItem.data, {});
        const originalDoc = item?.originalDoc;
        if (
          !originalDoc ||
          (originalDoc.folderSlug !== existing.slug &&
            originalDoc.folder !== currentData.name &&
            item.originalFolderSlug !== existing.slug)
        ) {
          continue;
        }
        await transaction.trashItem.updateMany({
          where: { id: trashItem.id, userId: user.id },
          data: {
            data: stringifyJsonText({
              ...item,
              originalFolder: "General",
              originalFolderName: "General",
              originalFolderSlug: "general",
              originalDoc: { ...originalDoc, folder: "General", folderSlug: "general" },
            }),
          },
        });
      }
    });

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
