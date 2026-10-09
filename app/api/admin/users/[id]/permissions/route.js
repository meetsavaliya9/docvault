import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import {
  applyPermissionDependencies,
  DEFAULT_USER_PERMISSIONS,
  MANAGER_PERMISSIONS,
  MANAGER_PERMISSION_GROUPS,
  PERMISSION_DEPENDENCIES,
  PERMISSIONS,
  createPermissionMap,
} from "@/lib/permissionConstants";
import { prisma } from "@/lib/prisma";
import { isConfiguredManager } from "@/lib/managerConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeDatasourceTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return {
      host: url.hostname,
      port: url.port || "3306",
      database: decodeURIComponent(url.pathname.slice(1)),
      username: decodeURIComponent(url.username),
    };
  } catch {
    return { configured: false };
  }
}

async function logRuntimeDatasourceTarget() {
  const [connected] = await prisma.$queryRaw`
    SELECT
      DATABASE() AS databaseName,
      @@hostname AS hostName,
      @@port AS port,
      CURRENT_USER() AS username
  `;
  console.info("Admin permissions Prisma datasource diagnostic:", {
    configured: getSafeDatasourceTarget(),
    connected: {
      host: connected.hostName,
      port: connected.port,
      database: connected.databaseName,
      username: connected.username,
    },
  });
}

async function getTargetUser(targetUserId) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  });
}

export async function GET(_request, { params }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    const user = await getTargetUser(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }
    if (
      isAdminEmail(user.email) ||
      user.role === "ADMIN" ||
      (user.role !== "USER" && !isConfiguredManager(user))
    ) {
      return NextResponse.json(
        { success: false, error: "Administrator permissions cannot be changed." },
        { status: 400 },
      );
    }

    if (process.env.NODE_ENV === "development") {
      await logRuntimeDatasourceTarget();
    }

    const records = await prisma.userPermission.findMany({
      where: {
        userId: user.id,
        ...(isConfiguredManager(user)
          ? { permission: { in: MANAGER_PERMISSIONS } }
          : {}),
      },
      select: { permission: true, enabled: true },
    });
    const permissions = createPermissionMap(
      user.role === "MANAGER" ? [] : DEFAULT_USER_PERMISSIONS,
    );
    for (const record of records) {
      permissions[record.permission] = record.enabled;
    }
    return NextResponse.json({
      success: true,
      userId: user.id,
      role: user.role,
      permissions: applyPermissionDependencies(permissions),
      ...(isConfiguredManager(user)
        ? { permissionGroups: MANAGER_PERMISSION_GROUPS }
        : {}),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin user permissions fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load user permissions. Check the MySQL connection and database migration." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await params;
    const user = await getTargetUser(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }
    if (
      isAdminEmail(user.email) ||
      user.role === "ADMIN" ||
      (user.role !== "USER" && !isConfiguredManager(user))
    ) {
      return NextResponse.json(
        { success: false, error: "Administrator permissions cannot be changed." },
        { status: 400 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const values = body?.permissions;
    const parentChanges = body?.parentChanges ?? {};
    const isManager = isConfiguredManager(user);
    if (
      !values ||
      typeof values !== "object" ||
      Array.isArray(values) ||
      PERMISSIONS.some((permission) => typeof values[permission] !== "boolean") ||
      Object.keys(values).some((permission) => !PERMISSIONS.includes(permission)) ||
      !parentChanges ||
      typeof parentChanges !== "object" ||
      Array.isArray(parentChanges) ||
      (isManager &&
        (Object.entries(values).some(
          ([permission, enabled]) =>
            enabled === true && !MANAGER_PERMISSIONS.includes(permission),
        ) ||
          Object.keys(parentChanges).some(
            (permission) => !MANAGER_PERMISSIONS.includes(permission),
          ))) ||
      Object.entries(parentChanges).some(
        ([permission, enabled]) =>
          !Object.hasOwn(PERMISSION_DEPENDENCIES, permission) ||
          typeof enabled !== "boolean",
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Provide a boolean value for every supported permission." },
        { status: 400 },
      );
    }

    const normalizedValues = applyPermissionDependencies(
      values,
      isManager ? {} : parentChanges,
    );
    const permissionsToSave = isManager ? MANAGER_PERMISSIONS : PERMISSIONS;
    if (
      isManager &&
      PERMISSIONS.some(
        (permission) =>
          !MANAGER_PERMISSIONS.includes(permission) &&
          normalizedValues[permission] === true,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Managers can only be assigned workspace and assigned-customer read permissions.",
        },
        { status: 400 },
      );
    }
    await prisma.$transaction(
      async (tx) => {
        if (isManager) {
          await tx.userPermission.updateMany({
            where: {
              userId: user.id,
              permission: { notIn: MANAGER_PERMISSIONS },
            },
            data: { enabled: false },
          });
        }
        await Promise.all(
          permissionsToSave.map((permission) =>
            tx.userPermission.upsert({
              where: { userId_permission: { userId: user.id, permission } },
              create: {
                id: randomUUID(),
                userId: user.id,
                permission,
                enabled: normalizedValues[permission],
              },
              update: { enabled: normalizedValues[permission] },
            }),
          ),
        );
      },
    );
    return NextResponse.json({
      success: true,
      role: user.role,
      permissions: normalizedValues,
      ...(isManager ? { permissionGroups: MANAGER_PERMISSION_GROUPS } : {}),
      message: `Permissions saved for ${user.email}.`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin user permissions update error:", error);
    return NextResponse.json(
      { success: false, error: "Could not save user permissions. Check the MySQL connection and database migration." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}