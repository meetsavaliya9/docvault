import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getPrivateAssetUrl } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  const isDownload = new URL(request.url).searchParams.get("download") === "1";
  const requiredPermission = isDownload ? "DOWNLOAD_DOCUMENT" : "PREVIEW_DOCUMENT";
  if (!(await hasPermission(user, requiredPermission))) {
    return NextResponse.json({ error: "You do not have permission to download documents." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const document = await prisma.document.findFirst({
      where: { id, userId: user.id },
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

    const disposition = new URL(request.url).searchParams.get("download") === "1"
      ? "attachment"
      : "inline";

    if (!document.cloudinaryPublicId && document.fileData?.startsWith("data:")) {
      const [, metadata, payload] = document.fileData.match(/^data:([^,]*),(.*)$/s) || [];
      if (metadata === undefined || payload === undefined) {
        return NextResponse.json({ error: "Document media is invalid." }, { status: 500 });
      }

      const metadataParts = metadata.split(";");
      const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(metadataParts[0])
        ? metadataParts[0]
        : "text/plain";
      let content;
      try {
        content = metadataParts.includes("base64")
          ? Buffer.from(payload, "base64")
          : Buffer.from(decodeURIComponent(payload));
      } catch (error) {
        console.error("Could not decode legacy document media:", error);
        return NextResponse.json({ error: "Document media is invalid." }, { status: 500 });
      }

      return new NextResponse(content, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "sandbox; default-src 'none'",
          "X-Content-Type-Options": "nosniff",
        },
      });
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
      console.error("Cloudinary media request failed:", assetResponse.status);
      return NextResponse.json(
        { error: "Could not load the file from Cloudinary." },
        { status: 502 }
      );
    }

    const headers = new Headers({
      "Content-Type": assetResponse.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const contentLength = assetResponse.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(assetResponse.body, { headers });
  } catch (error) {
    console.error("Could not serve private Cloudinary media:", error);
    return NextResponse.json(
      { error: "Could not load the file from Cloudinary. Check the Cloudinary configuration." },
      { status: 502 }
    );
  }
}
