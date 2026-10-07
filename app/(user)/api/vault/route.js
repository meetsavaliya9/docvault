import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { deletePrivateAsset } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const [folders, trash] = await Promise.all([
      prisma.folder.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } }),
      prisma.trashItem.findMany({ where: { userId: user.id }, orderBy: { id: "desc" } }),
    ]);

    return NextResponse.json(
      {
        folders: folders.map((folder) => folder.data),
        trash: trash.map((item) => item.data),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to load vault settings from MySQL:", error);
    return NextResponse.json(
      { error: "Could not load folders or trash from MySQL. Check database availability." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.folders) || !Array.isArray(body?.trash)) {
    return NextResponse.json(
      { error: "Vault data must include folders and trash arrays." },
      { status: 400 }
    );
  }

  if (
    body.folders.some(
      (folder) =>
        !folder ||
        typeof folder.id !== "string" ||
        typeof folder.slug !== "string" ||
        typeof folder.name !== "string"
    ) ||
    body.trash.some((item) => !item || typeof item.id !== "string")
  ) {
    return NextResponse.json(
      { error: "Folder or trash data contains an invalid record." },
      { status: 400 }
    );
  }

  try {
    const previousTrash = await prisma.trashItem.findMany({
      where: { userId: user.id },
      select: { data: true },
    });
    const retainedTrashIds = new Set(body.trash.map((item) => item.id));
    const removedTrashDocuments = previousTrash
      .filter((item) => !retainedTrashIds.has(item.data?.id))
      .map((item) => item.data?.originalDoc)
      .filter(
        (document) =>
          document &&
          typeof document.cloudinaryPublicId === "string" &&
          document.cloudinaryPublicId.startsWith(`docvault/${user.id}/`) &&
          ["image", "video", "raw"].includes(document.cloudinaryResourceType)
      );

    await prisma.$transaction([
      prisma.folder.deleteMany({ where: { userId: user.id } }),
      ...(body.folders.length
        ? [
            prisma.folder.createMany({
              data: body.folders.map((folder) => ({
                id: `${user.id}-${folder.id}`,
                userId: user.id,
                slug: folder.slug,
                data: folder,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      prisma.trashItem.deleteMany({ where: { userId: user.id } }),
      ...(body.trash.length
        ? [
            prisma.trashItem.createMany({
              data: body.trash.map((item) => ({
                id: `${user.id}-${item.id}`,
                userId: user.id,
                data: item,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    const savedDocumentAssets = new Set(
        (
          await prisma.document.findMany({
            where: { userId: user.id },
            select: { cloudinaryPublicId: true },
          })
        )
          .map((document) => document.cloudinaryPublicId)
          .filter(Boolean)
    );
    let cleanupFailed = false;
    for (const document of removedTrashDocuments) {
        if (savedDocumentAssets.has(document.cloudinaryPublicId)) continue;
        try {
          await deletePrivateAsset(
            document.cloudinaryPublicId,
            document.cloudinaryResourceType
          );
        } catch (error) {
          cleanupFailed = true;
          console.error("Could not remove permanently deleted Cloudinary media:", error);
        }
    }

    return NextResponse.json({
        success: true,
        warning: cleanupFailed
          ? "Trash was updated, but some Cloudinary media could not be removed."
          : undefined,
    });
  } catch (error) {
    console.error("Failed to save vault settings to MySQL:", error);
    return NextResponse.json(
      { error: "Could not save folders or trash to MySQL. Please try again." },
      { status: 500 }
    );
  }
}
