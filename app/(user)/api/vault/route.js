import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { deletePrivateAsset } from "@/lib/cloudinary";
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

function getSafeDatasourceTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return {
      host: url.hostname,
      port: url.port || "3306",
      database: decodeURIComponent(url.pathname.slice(1)),
      username: decodeURIComponent(url.username),
    };
  } catch {
    return { configured: false };
  }
}

function logVaultDatabaseError(error) {
  const message = String(error?.message || "").replace(
    /(?:mysql|mariadb):\/\/[^@\s]+@/gi,
    "$1://[REDACTED]@",
  );
  console.error("Vault API error:", {
    name: error?.name || "Error",
    code: error?.code || null,
    message: message.slice(0, 1000),
    configuredDatasource: getSafeDatasourceTarget(),
  });
}

export async function GET() {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    logVaultDatabaseError(error);
    return NextResponse.json(
      { success: false, error: "Could not authenticate or connect to the vault database." },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const [connectedTarget] = await prisma.$queryRaw`
      SELECT DATABASE() AS databaseName, @@hostname AS hostName, @@port AS port, CURRENT_USER() AS username
    `;
    console.info("Vault API Prisma datasource:", {
      configured: getSafeDatasourceTarget(),
      connected: {
        host: connectedTarget.hostName,
        port: String(connectedTarget.port),
        database: connectedTarget.databaseName,
        username: connectedTarget.username,
      },
    });
    const [canViewFolders, canViewTrash] = await Promise.all([
      hasPermission(user, "VIEW_FOLDERS"),
      hasPermission(user, "VIEW_TRASH"),
    ]);
    const [folders, trash] = await Promise.all([
      canViewFolders
        ? prisma.folder.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } })
        : Promise.resolve([]),
      canViewTrash
        ? prisma.trashItem.findMany({ where: { userId: user.id }, orderBy: { id: "desc" } })
        : Promise.resolve([]),
    ]);

    return NextResponse.json(
      {
        folders: folders.map((folder) => parseJsonText(folder.data, {})),
        trash: trash.map((item) => parseJsonText(item.data, {})),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    logVaultDatabaseError(error);
    return NextResponse.json(
      { success: false, error: "Could not load folders or trash from MySQL. Check database availability." },
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

  const trashAction = body.trashAction || null;
  if (trashAction && !["add", "restore", "delete", "empty"].includes(trashAction)) {
    return NextResponse.json({ error: "The requested trash action is invalid." }, { status: 400 });
  }

  try {
    const [previousTrash, previousFolders] = await Promise.all([
      prisma.trashItem.findMany({
        where: { userId: user.id },
        select: { data: true },
      }),
      prisma.folder.findMany({
        where: { userId: user.id },
        select: { id: true, slug: true, data: true },
      }),
    ]);
    const canViewTrash = await hasPermission(user, "VIEW_TRASH");
    const canViewFolders = await hasPermission(user, "VIEW_FOLDERS");
    const previousFolderById = new Map(
      previousFolders.map((folder) => {
        const data = parseJsonText(folder.data, {});
        return [String(data.id || folder.slug), data];
      }),
    );
    const incomingFolderById = new Map(body.folders.map((folder) => [String(folder.id), folder]));
    const addedFolders = canViewFolders
      ? [...incomingFolderById.entries()].filter(([id]) => !previousFolderById.has(id))
      : [];
    const removedFolders = canViewFolders
      ? [...previousFolderById.keys()].filter((id) => !incomingFolderById.has(id))
      : [];
    const updatedFolders = canViewFolders
      ? [...incomingFolderById.entries()].filter(([id, folder]) => {
          const previous = previousFolderById.get(id);
          return previous && JSON.stringify(previous) !== JSON.stringify(folder);
        })
      : [];

    if (!canViewFolders && body.folders.length > 0) {
      return NextResponse.json({ error: "You do not have permission to update folders." }, { status: 403 });
    }
    if (addedFolders.length && !(await hasPermission(user, "CREATE_FOLDER"))) {
      return NextResponse.json({ error: "You do not have permission to create folders." }, { status: 403 });
    }
    if (removedFolders.length && !(await hasPermission(user, "DELETE_FOLDER"))) {
      return NextResponse.json({ error: "You do not have permission to delete folders." }, { status: 403 });
    }
    if (updatedFolders.length && !(await hasPermission(user, "RENAME_FOLDER"))) {
      return NextResponse.json({ error: "You do not have permission to rename folders." }, { status: 403 });
    }

    const previousById = new Map(previousTrash.map((item) => {
      const data = parseJsonText(item.data, {});
      return [String(data?.id), data];
    }));
    const incomingById = new Map(body.trash.map((item) => [String(item.id), item]));
    const removedTrash = canViewTrash
      ? [...previousById.entries()].filter(([id]) => !incomingById.has(id))
      : [];
    const addedTrash = trashAction === "add"
      ? [...incomingById.entries()].filter(([id]) => !previousById.has(id))
      : canViewTrash
      ? [...incomingById.entries()].filter(([id]) => !previousById.has(id))
      : [];

    if ((removedTrash.length || addedTrash.length) && !trashAction) {
      return NextResponse.json({ error: "Trash changes require an explicit authorized action." }, { status: 403 });
    }
    if (trashAction && trashAction !== "add" && !canViewTrash) {
      return NextResponse.json({ error: "You do not have permission to view or change Trash." }, { status: 403 });
    }

    const requiredPermission = {
      add: "DELETE_DOCUMENT",
      restore: "RESTORE_DOCUMENT",
      delete: "PERMANENT_DELETE_DOCUMENT",
      empty: "EMPTY_TRASH",
    }[trashAction];
    if (trashAction && !(await hasPermission(user, requiredPermission))) {
      return NextResponse.json({ error: `You do not have permission to ${trashAction} Trash items.` }, { status: 403 });
    }

    if (
      (trashAction === "add" && (addedTrash.length === 0 || removedTrash.length > 0)) ||
      (trashAction === "restore" && (removedTrash.length === 0 || addedTrash.length > 0)) ||
      (trashAction === "delete" && (removedTrash.length !== 1 || addedTrash.length > 0)) ||
      (trashAction === "empty" && (body.trash.length !== 0 || removedTrash.length === 0 || addedTrash.length > 0))
    ) {
      return NextResponse.json({ error: "The requested trash change does not match its action." }, { status: 400 });
    }

    if (trashAction === "restore") {
      const restoredDocumentIds = removedTrash
        .map(([, item]) => item?.originalDoc?.id)
        .filter((id) => typeof id === "string");
      const restoredDocuments = await prisma.document.findMany({
        where: { userId: user.id, id: { in: restoredDocumentIds } },
        select: { id: true },
      });
      if (restoredDocuments.length !== removedTrash.length) {
        return NextResponse.json({ error: "Restored documents must belong to your account." }, { status: 403 });
      }
    }

    if (trashAction === "delete" || trashAction === "empty") {
      const removedDocumentIds = removedTrash
        .map(([, item]) => item?.originalDoc?.id)
        .filter((id) => typeof id === "string");
      const retainedDocuments = await prisma.document.findMany({
        where: { userId: user.id, id: { in: removedDocumentIds } },
        select: { id: true },
      });
      if (retainedDocuments.length > 0) {
        return NextResponse.json({ error: "Trash items cannot be permanently removed while their documents are active." }, { status: 409 });
      }
    }

    const removedTrashDocuments = removedTrash
      .map(([, item]) => item?.originalDoc)
      .filter(
        (document) =>
          document &&
          typeof document.cloudinaryPublicId === "string" &&
          document.cloudinaryPublicId.startsWith(`docvault/${user.id}/`) &&
          ["image", "video", "raw"].includes(document.cloudinaryResourceType)
      );

    const folderOperations = canViewFolders && (addedFolders.length || removedFolders.length || updatedFolders.length)
      ? [
          prisma.folder.deleteMany({ where: { userId: user.id } }),
          ...(body.folders.length
        ? [
            prisma.folder.createMany({
              data: body.folders.map((folder) => ({
                id: `${user.id}-${folder.id}`,
                userId: user.id,
                slug: folder.slug,
                data: stringifyJsonText(folder),
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
        ]
      : [];

    await prisma.$transaction([
      ...folderOperations,
      ...(removedTrash.length
        ? [
            prisma.trashItem.deleteMany({
              where: {
                userId: user.id,
                id: { in: removedTrash.map(([id]) => `${user.id}-${id}`) },
              },
            }),
          ]
        : []),
      ...(addedTrash.length
        ? [
            prisma.trashItem.createMany({
              data: addedTrash.map(([, item]) => ({
                id: `${user.id}-${item.id}`,
                userId: user.id,
                data: stringifyJsonText(item),
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
