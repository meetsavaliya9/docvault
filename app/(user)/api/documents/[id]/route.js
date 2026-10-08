import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { mapDocument } from "@/app/lib/documents";
import { deletePrivateAsset } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

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
    return NextResponse.json({ error: "You are not signed in." }, { status: 401, headers: NO_CACHE_HEADERS });
  }
  if (!(await hasPermission(user, "VIEW_DOCUMENTS"))) {
    return NextResponse.json({ error: "You do not have permission to view documents." }, { status: 403, headers: NO_CACHE_HEADERS });
  }

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const data = {};
  if (typeof body.starred === "boolean") {
    data.starred = body.starred;
  }
  if (typeof body.folder === "string" && body.folder.trim()) {
    data.folder = body.folder.trim().slice(0, 255);
  }
  if (typeof body.folderSlug === "string" && body.folderSlug.trim()) {
    data.folderSlug = body.folderSlug.trim().slice(0, 120);
  }
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim().slice(0, 255);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one field to update (starred, folder, folderSlug, name)." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  if (Object.hasOwn(data, "name") && !(await hasPermission(user, "RENAME_DOCUMENT"))) {
    return NextResponse.json({ error: "You do not have permission to rename documents." }, { status: 403, headers: NO_CACHE_HEADERS });
  }

  try {
    const updated = await prisma.document.updateMany({
      where: { id, userId: user.id },
      data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const document = await prisma.document.findFirst({
      where: { id, userId: user.id },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      document: mapDocument(document),
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to update document in MySQL:", error);
    return NextResponse.json(
      { error: "Could not update document in MySQL. Please try again." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(request, { params }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }
  if (!(await hasPermission(user, "DELETE_DOCUMENT"))) {
    return NextResponse.json({ error: "You do not have permission to delete documents." }, { status: 403, headers: NO_CACHE_HEADERS });
  }

  const { id } = await params;
  try {
    const document = await prisma.document.findFirst({
      where: { id, userId: user.id },
      select: {
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
      },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const result = await prisma.document.deleteMany({
      where: { id, userId: user.id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    let warning;
    if (
      new URL(request.url).searchParams.get("permanent") === "true" &&
      document.cloudinaryPublicId &&
      document.cloudinaryResourceType
    ) {
      try {
        const deletion = await deletePrivateAsset(
          document.cloudinaryPublicId,
          document.cloudinaryResourceType
        );
        if (deletion.result !== "ok" && deletion.result !== "not found") {
          warning = "The document was deleted, but Cloudinary did not confirm media removal.";
        }
      } catch (error) {
        console.error("Document was deleted but Cloudinary media cleanup failed:", error);
        warning = "The document was deleted, but its Cloudinary media could not be removed.";
      }
    }

    return NextResponse.json({ success: true, warning }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to delete document from MySQL:", error);
    return NextResponse.json(
      { error: "Could not delete document from MySQL. Please try again." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
