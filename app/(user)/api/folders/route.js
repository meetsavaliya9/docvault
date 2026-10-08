import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { parseJsonText, stringifyJsonText } from "@/lib/jsonText";
import { ensureUserFolders, normalizeFolderSlug } from "@/lib/userFolders";

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
  if (!(await hasPermission(user, "VIEW_FOLDERS"))) {
    return NextResponse.json({ error: "You do not have permission to view folders." }, { status: 403, headers: NO_CACHE_HEADERS });
  }

  try {
    const folders = await ensureUserFolders(user.id);

    return NextResponse.json(
      {
        folders: folders.map((folder) => {
          const data = parseJsonText(folder.data, {});
          return { ...data, id: data.id || folder.id, slug: folder.slug };
        }),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to load folders from MySQL:", error);
    return NextResponse.json(
      { error: "Could not load folders." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }
  if (!(await hasPermission(user, "CREATE_FOLDER"))) {
    return NextResponse.json({ error: "You do not have permission to create folders." }, { status: 403, headers: NO_CACHE_HEADERS });
  }
  if (!(await hasPermission(user, "VIEW_FOLDERS"))) {
    return NextResponse.json({ error: "You do not have permission to view folders." }, { status: 403, headers: NO_CACHE_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Folder name is required." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const name = body.name.trim();
  if (name.length > 255) {
    return NextResponse.json(
      { error: "Folder names must be 255 characters or fewer." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
  const baseSlug = normalizeFolderSlug(body.slug || name) || `folder-${randomUUID()}`;
  if (baseSlug === "general" || baseSlug === "root") {
    return NextResponse.json(
      { error: "That folder name is reserved for the root location." },
      { status: 409, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    await ensureUserFolders(user.id);
    const folderId = randomUUID();
    let finalSlug = baseSlug;
    for (let suffix = 1; suffix <= 100; suffix += 1) {
      const candidate = suffix === 1 ? baseSlug : `${baseSlug.slice(0, 114)}-${suffix}`;
      try {
        const folderData = {
          id: folderId,
          name,
          slug: candidate,
          description:
            typeof body.description === "string"
              ? body.description.trim().slice(0, 500)
              : "Custom folder collection.",
          color: typeof body.color === "string" ? body.color : "indigo",
          bgLight: typeof body.bgLight === "string" ? body.bgLight : "bg-indigo-50",
          textColor: typeof body.textColor === "string" ? body.textColor : "text-indigo-600",
          borderColor:
            typeof body.borderColor === "string" ? body.borderColor : "border-indigo-200/70",
        };
        await prisma.folder.create({
          data: {
            id: `${user.id}-${folderId}`,
            userId: user.id,
            slug: candidate,
            data: stringifyJsonText(folderData),
          },
        });
        finalSlug = candidate;
        return NextResponse.json(
          { folder: { ...folderData, slug: finalSlug } },
          { status: 201, headers: NO_CACHE_HEADERS }
        );
      } catch (error) {
        if (error?.code !== "P2002") throw error;
      }
    }
    return NextResponse.json(
      { error: "Could not create a unique folder name." },
      { status: 409, headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to create folder in MySQL:", error);
    return NextResponse.json(
      { error: "Could not create folder." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
