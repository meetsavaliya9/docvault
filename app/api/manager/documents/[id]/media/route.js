import { NextResponse } from "next/server";
import { getAdminEmails } from "@/lib/auth/admin";
import { requireManagerPermission } from "@/lib/auth/workspacePermission";
import { getPrivateAssetUrl } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { response } = await requireManagerPermission("VIEW_USER_FILES");
  if (response) return response;

  const { id } = await params;
  const adminEmails = getAdminEmails();
  let document;
  try {
    document = await prisma.document.findFirst({
      where: {
        id,
        deleted: false,
        user: {
          is: {
            role: "USER",
            ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
          },
        },
      },
      select: {
        name: true,
        fileData: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
        cloudinaryVersion: true,
      },
    });
  } catch (error) {
    console.error("Manager document media lookup failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load document media." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!document) {
    return NextResponse.json(
      { error: "Document media not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const isDownload = new URL(request.url).searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";
    const headers = new Headers({
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (!isDownload) {
      headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
    }

    if (!document.cloudinaryPublicId && document.fileData?.startsWith("data:")) {
      const [, metadata, payload] = document.fileData.match(/^data:([^,]*),(.*)$/s) || [];
      if (metadata === undefined || payload === undefined) {
        return NextResponse.json(
          { error: "Document media is invalid." },
          { status: 500, headers: { "Cache-Control": "no-store" } },
        );
      }

      const parts = metadata.split(";");
      headers.set(
        "Content-Type",
        /^[\w.+-]+\/[\w.+-]+$/.test(parts[0]) ? parts[0] : "application/octet-stream",
      );

      let content;
      try {
        content = parts.includes("base64")
          ? Buffer.from(payload, "base64")
          : Buffer.from(decodeURIComponent(payload));
      } catch (error) {
        console.error("Could not decode Manager document media:", {
          name: error?.name,
          code: error?.code,
        });
        return NextResponse.json(
          { error: "Document media is invalid." },
          { status: 500, headers: { "Cache-Control": "no-store" } },
        );
      }
      return new NextResponse(content, { headers });
    }

    if (
      !document.cloudinaryPublicId ||
      !document.cloudinaryResourceType ||
      !document.cloudinaryVersion
    ) {
      return NextResponse.json(
        { error: "Document media not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const assetUrl = getPrivateAssetUrl(
      document.cloudinaryPublicId,
      document.cloudinaryResourceType,
      document.cloudinaryVersion,
    );
    const assetResponse = await fetch(assetUrl);
    if (!assetResponse.ok || !assetResponse.body) {
      console.error("Manager Cloudinary media request failed:", {
        status: assetResponse.status,
      });
      return NextResponse.json(
        { error: "Could not load the file from Cloudinary." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    headers.set(
      "Content-Type",
      assetResponse.headers.get("content-type") || "application/octet-stream",
    );
    const contentLength = assetResponse.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    return new NextResponse(assetResponse.body, { headers });
  } catch (error) {
    console.error("Could not fetch Manager document media:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load the file from Cloudinary." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
