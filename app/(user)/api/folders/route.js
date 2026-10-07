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

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "You are not signed in." },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(
      { folders: folders.map((f) => ({ ...f.data, id: f.id, slug: f.slug })) },
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
  let baseSlug = body.slug
    ? String(body.slug).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (!baseSlug) baseSlug = `folder-${Date.now()}`;

  // Check if folder slug already exists for this user
  let finalSlug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await prisma.folder.findUnique({
      where: {
        userId_slug: {
          userId: user.id,
          slug: finalSlug,
        },
      },
    });
    if (!existing) break;
    finalSlug = `${baseSlug}-${counter++}`;
  }

  const folderData = {
    id: `f-${Date.now()}`,
    name,
    slug: finalSlug,
    description: typeof body.description === "string" ? body.description.trim() : "Custom folder collection.",
    color: body.color || "indigo",
    bgLight: body.bgLight || "bg-indigo-50",
    textColor: body.textColor || "text-indigo-600",
    borderColor: body.borderColor || "border-indigo-200/70",
  };

  try {
    const folder = await prisma.folder.create({
      data: {
        userId: user.id,
        slug: finalSlug,
        data: folderData,
      },
    });

    return NextResponse.json(
      { folder: folder.data },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("Failed to create folder in MySQL:", error);
    return NextResponse.json(
      { error: "Could not create folder." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
