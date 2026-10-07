import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { deletePrivateAsset, getPrivateAssetUrl } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id: documentId } = await params;
  if (!documentId) {
    return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
  }

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        name: true,
        fileData: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
        cloudinaryVersion: true,
      },
    });
    if (!document) {
      return NextResponse.json({ error: "Document media not found." }, { status: 404 });
    }

    const headers = {
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };

    if (!document.cloudinaryPublicId && document.fileData?.startsWith("data:")) {
      const [, metadata, payload] = document.fileData.match(/^data:([^,]*),(.*)$/s) || [];
      if (metadata === undefined || payload === undefined) {
        return NextResponse.json({ error: "Document media is invalid." }, { status: 500 });
      }

      const metadataParts = metadata.split(";");
      headers["Content-Type"] = /^[\w.+-]+\/[\w.+-]+$/.test(metadataParts[0])
        ? metadataParts[0]
        : "text/plain";
      headers["Content-Security-Policy"] = "sandbox; default-src 'none'";

      let content;
      try {
        content = metadataParts.includes("base64")
          ? Buffer.from(payload, "base64")
          : Buffer.from(decodeURIComponent(payload));
      } catch (error) {
        console.error("Could not decode legacy admin document media:", error);
        return NextResponse.json({ error: "Document media is invalid." }, { status: 500 });
      }

      return new NextResponse(content, { headers });
    }

    if (
      !document.cloudinaryPublicId ||
      !document.cloudinaryResourceType ||
      !document.cloudinaryVersion
    ) {
      return NextResponse.json({ error: "Document media not found." }, { status: 404 });
    }

    const assetUrl = getPrivateAssetUrl(
      document.cloudinaryPublicId,
      document.cloudinaryResourceType,
      document.cloudinaryVersion
    );
    const assetResponse = await fetch(assetUrl);
    if (!assetResponse.ok || !assetResponse.body) {
      console.error("Cloudinary admin media request failed:", assetResponse.status);
      return NextResponse.json(
        { error: "Could not load the file from Cloudinary." },
        { status: 502 }
      );
    }

    headers["Content-Type"] = assetResponse.headers.get("content-type") || "application/octet-stream";
    const contentLength = assetResponse.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;
    return new NextResponse(assetResponse.body, { headers });
  } catch (error) {
    console.error("Could not serve admin document media:", error);
    return NextResponse.json(
      { error: "Could not load document media." },
      { status: 502 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const userIdParams = url.searchParams.getAll("userId");
  if (userIdParams.length > 1 || (userIdParams.length === 1 && !userIdParams[0].trim())) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const selectedUserId = userIdParams.length === 1 ? userIdParams[0] : null;
  const { id: documentId } = await params;
  if (!documentId) {
    return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
  }

  try {
    if (
      selectedUserId !== null &&
      !(await prisma.user.findUnique({ where: { id: selectedUserId }, select: { id: true } }))
    ) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        ...(selectedUserId !== null ? { userId: selectedUserId } : {}),
      },
      select: {
        id: true,
        name: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (document.cloudinaryPublicId) {
      try {
        await deletePrivateAsset(
          document.cloudinaryPublicId,
          document.cloudinaryResourceType || "raw"
        );
      } catch (cloudErr) {
        console.warn(`Could not delete asset ${document.cloudinaryPublicId} from Cloudinary:`, cloudErr);
      }
    }

    await prisma.document.delete({
      where: {
        id: documentId,
        ...(selectedUserId !== null ? { userId: selectedUserId } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Document "${document.name}" has been permanently removed by administrator.`,
    });
  } catch (error) {
    console.error("Admin document delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}
