import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  applyPermissionDependencies,
  DEFAULT_USER_PERMISSIONS,
  getPermissionParents,
  MANAGER_PERMISSIONS,
  PERMISSIONS,
  createPermissionMap,
} from "@/lib/permissionConstants";
import { prisma } from "@/lib/prisma";
import { isConfiguredManager } from "@/lib/managerConfig";

export function getUserRole(user) {
  if (isAdminEmail(user?.email) || user?.role === "ADMIN") return "ADMIN";
  return isConfiguredManager(user) ? "MANAGER" : "USER";
}

export async function getUserPermissions(user) {
  if (!user?.id) return createPermissionMap();
  if (getUserRole(user) === "ADMIN") return createPermissionMap(PERMISSIONS);

  const isManager = getUserRole(user) === "MANAGER";
  const manageablePermissions = isManager ? MANAGER_PERMISSIONS : PERMISSIONS;
  const records = await prisma.userPermission.findMany({
    where: {
      userId: user.id,
      permission: { in: manageablePermissions },
    },
    select: { permission: true, enabled: true },
  });
  const permissions = createPermissionMap(
    isManager ? [] : DEFAULT_USER_PERMISSIONS,
  );
  for (const record of records) {
    permissions[record.permission] = record.enabled;
  }
  return applyPermissionDependencies(permissions);
}

export async function hasPermission(user, permission) {
  if (!PERMISSIONS.includes(permission) || !user?.id) return false;
  if (getUserRole(user) === "ADMIN") return true;

  const isManager = getUserRole(user) === "MANAGER";
  if (isManager && !MANAGER_PERMISSIONS.includes(permission)) return false;
  const requiredPermissions = [permission, ...getPermissionParents(permission)];
  const allowedPermissions = isManager
    ? requiredPermissions.filter((value) => MANAGER_PERMISSIONS.includes(value))
    : requiredPermissions;
  const records = await prisma.userPermission.findMany({
    where: { userId: user.id, permission: { in: allowedPermissions } },
    select: { permission: true, enabled: true },
  });
  const values = createPermissionMap(
    isManager ? [] : DEFAULT_USER_PERMISSIONS,
  );
  for (const record of records) {
    values[record.permission] = record.enabled;
  }
  return applyPermissionDependencies(values)[permission] === true;
}

export async function requirePagePermission(permission) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return hasPermission(user, permission);
}