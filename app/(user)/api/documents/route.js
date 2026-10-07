import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { mapDocument } from "@/app/lib/documents";
import {
  createDocumentWithinQuota,
  PlanLimitExceededError,
} from "@/lib/billing";
import {
  deletePrivateAsset,
  getPrivateAssetMetadata,
  uploadPrivateAsset,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

export async function GET(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const { searchParams } = new URL(request.url);
  const starred = searchParams.get("starred");
  const folderSlug = searchParams.get("folder");
  const search = searchParams.get("search");

  const where = {
    userId: user.id,
    deleted: false,
  };

  if (starred === "true") {
    where.starred = true;
  }
  if (folderSlug && folderSlug !== "all") {
    where.folderSlug = folderSlug;
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q } },
      { type: { contains: q } },
      { folder: { contains: q } },
    ];
  }

  try {
    const [documents, legacyMedia] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          rawBytes: true,
          modified: true,
          starred: true,
          deleted: true,
          folder: true,
          folderSlug: true,
          hash: true,
          cloudinaryPublicId: true,
          cloudinaryResourceType: true,
          cloudinaryVersion: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.document.findMany({
        where: { ...where, cloudinaryPublicId: null, fileData: { not: null } },
        select: { id: true },
      }),
    ]);
    const legacyMediaIds = new Set(legacyMedia.map(({ id }) => id));

    return NextResponse.json(
      {
        documents: documents
          .map((document) =>
            mapDocument(document, {
              deferFileData: true,
              hasFileData: legacyMediaIds.has(document.id),
            })
          )
          .filter(Boolean),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to load documents from MySQL:", error);
    return NextResponse.json(
      { error: "Could not load documents from MySQL. Check DATABASE_URL and database availability." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  let cloudinaryAsset = null;
  let uploadBuffer = null;
  let uploadFilename = null;
  let isFileUpload = false;
  try {
    let fields;
    let fileData = null;
    let rawBytes = 0;
    let verifiedCloudinaryBytes = null;

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      isFileUpload = true;
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Files must be 15 MB or smaller." },
          { status: 413 }
        );
      }
      rawBytes = file.size;
      uploadBuffer = Buffer.from(await file.arrayBuffer());
      uploadFilename = file.name;
      const extension = file.name.includes(".")
        ? file.name.split(".").pop().toUpperCase()
        : "FILE";
      fields = {
        id: `doc-${randomUUID()}`,
        name: file.name,
        type: extension,
        size: formatBytes(file.size),
        folder: String(formData.get("folder") || "General"),
        folderSlug: String(formData.get("folderSlug") || "general"),
        hash: randomUUID(),
      };
    } else {
      fields = await request.json();
      fileData = fields.fileData || fields.dataUrl || null;
      if (fields.cloudinaryPublicId) {
        const ownedPrefix = `docvault/${user.id}/`;
        if (
          typeof fields.cloudinaryPublicId !== "string" ||
          !fields.cloudinaryPublicId.startsWith(ownedPrefix) ||
          !["image", "video", "raw"].includes(fields.cloudinaryResourceType) ||
          !Number.isInteger(fields.cloudinaryVersion)
        ) {
          return NextResponse.json(
            { error: "The Cloudinary document reference is invalid." },
            { status: 400 }
          );
        }
        const asset = await getPrivateAssetMetadata(
          fields.cloudinaryPublicId,
          fields.cloudinaryResourceType
        );
        verifiedCloudinaryBytes = asset.bytes;
      }
      if (typeof fileData === "string") {
        if (fileData.startsWith("data:")) {
          const separatorIndex = fileData.indexOf(",");
          if (separatorIndex < 0) {
            return NextResponse.json(
              { error: "The file data is invalid." },
              { status: 400 }
            );
          }
          rawBytes = Buffer.from(fileData.slice(separatorIndex + 1), "base64").byteLength;
        } else {
          rawBytes = Buffer.byteLength(fileData, "utf8");
        }
      }
      if (verifiedCloudinaryBytes !== null) {
        rawBytes = verifiedCloudinaryBytes;
      }
      if (!Number.isSafeInteger(rawBytes) || rawBytes < 0) {
        return NextResponse.json(
          { error: "The document size is invalid." },
          { status: 400 }
        );
      }
      if (rawBytes > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Files must be 15 MB or smaller." },
          { status: 413 }
        );
      }
    }

    if (
      typeof fields.name !== "string" ||
      !fields.name.trim() ||
      fields.name.length > 255 ||
      typeof fields.type !== "string" ||
      !fields.type.trim() ||
      fields.type.length > 40 ||
      typeof fields.size !== "string" ||
      fields.size.length > 40
    ) {
      return NextResponse.json(
        { error: "Document name, type, and size are required." },
        { status: 400 }
      );
    }

    const createdAt = fields.createdAt ? new Date(fields.createdAt) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: "Invalid document creation date." }, { status: 400 });
    }

    if (uploadBuffer) {
      cloudinaryAsset = await uploadPrivateAsset(uploadBuffer, user.id, uploadFilename);
    }

    const document = await createDocumentWithinQuota(user.id, {
        id: typeof fields.id === "string" && fields.id.length <= 100
          ? fields.id
          : `doc-${randomUUID()}`,
        userId: user.id,
        name: fields.name.trim(),
        type: fields.type.trim().toUpperCase(),
        size: fields.size,
        rawBytes,
        modified: fields.modified || "Just now",
        starred: Boolean(fields.starred),
        deleted: false,
        folder: typeof fields.folder === "string" ? fields.folder.slice(0, 255) : "General",
        folderSlug:
          typeof fields.folderSlug === "string"
            ? fields.folderSlug.slice(0, 120)
            : "general",
        hash: typeof fields.hash === "string" ? fields.hash.slice(0, 100) : null,
        fileData,
        cloudinaryPublicId:
          cloudinaryAsset?.public_id || fields.cloudinaryPublicId || null,
        cloudinaryResourceType:
          cloudinaryAsset?.resource_type || fields.cloudinaryResourceType || null,
        cloudinaryVersion:
          cloudinaryAsset?.version || fields.cloudinaryVersion || null,
        createdAt,
    });

    return NextResponse.json({ document: mapDocument(document) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create document in MySQL:", error);
    if (cloudinaryAsset) {
      try {
        await deletePrivateAsset(
          cloudinaryAsset.public_id,
          cloudinaryAsset.resource_type
        );
      } catch (cleanupError) {
        console.error("Could not clean up Cloudinary asset after database failure:", cleanupError);
      }
    }

    if (error instanceof PlanLimitExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.kind === "documents"
            ? "DOCUMENT_LIMIT_EXCEEDED"
            : "STORAGE_QUOTA_EXCEEDED",
          current: error.current,
          incoming: error.incoming,
          limit: error.limit,
          plan: error.planKey,
        },
        { status: 413 }
      );
    }

    if (error.message?.startsWith("Cloudinary is not configured.")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (isFileUpload && !cloudinaryAsset) {
      return NextResponse.json(
        { error: "Could not upload the file to Cloudinary. Check your Cloudinary settings and try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        error: cloudinaryAsset
          ? "The file reached Cloudinary but its document record could not be saved. Check MySQL and try again."
          : "Could not save the document. Check Cloudinary/MySQL configuration and try again.",
      },
      { status: 500 }
    );
  }
}
