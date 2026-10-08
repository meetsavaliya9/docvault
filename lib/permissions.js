import "server-only";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { DEFAULT_USER_PERMISSIONS, PERMISSIONS, createPermissionMap } from "@/lib/permissionConstants";
import { prisma } from "@/lib/prisma";

export function getUserRole(user) {
  return isAdminEmail(user?.email) ? "ADMIN" : "USER";
}

export async function getUserPermissions(user) {
  if (!user?.id) return createPermissionMap();
  if (getUserRole(user) === "ADMIN") return createPermissionMap(DEFAULT_USER_PERMISSIONS);

  const records = await prisma.userPermission.findMany({
    where: { userId: user.id },
    select: { permission: true, enabled: true },
  });
  const permissions = createPermissionMap(DEFAULT_USER_PERMISSIONS);
  for (const record of records) {
    permissions[record.permission] = record.enabled;
  }
  return permissions;
}

export async function hasPermission(user, permission) {
  if (!PERMISSIONS.includes(permission) || !user?.id) return false;
  if (getUserRole(user) === "ADMIN") return true;

  const record = await prisma.userPermission.findUnique({
    where: { userId_permission: { userId: user.id, permission } },
    select: { enabled: true },
  });
  return record ? record.enabled : DEFAULT_USER_PERMISSIONS.includes(permission);
}

export async function requirePagePermission(permission) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user, permission))) notFound();
}