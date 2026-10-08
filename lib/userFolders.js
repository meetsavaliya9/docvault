import "server-only";
import { prisma } from "@/lib/prisma";
import { stringifyJsonText } from "@/lib/jsonText";
import { DEFAULT_FOLDERS } from "@/lib/defaultFolders";

export async function ensureUserFolders(userId, client = prisma) {
  const existing = await client.folder.findMany({
    where: { userId },
    orderBy: { id: "asc" },
  });
  if (existing.length > 0) return existing;

  await client.folder.createMany({
    data: DEFAULT_FOLDERS.map((folder) => ({
      id: `${userId}-${folder.id}`,
      userId,
      slug: folder.slug,
      data: stringifyJsonText(folder),
    })),
    skipDuplicates: true,
  });

  return client.folder.findMany({
    where: { userId },
    orderBy: { id: "asc" },
  });
}

export function normalizeFolderSlug(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
