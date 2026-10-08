import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { DEFAULT_USER_PERMISSIONS, PERMISSIONS, createPermissionMap } from "@/lib/permissionConstants";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getTargetUser(targetUserId) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
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
    if (isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "Administrator permissions cannot be changed." },
        { status: 400 },
      );
    }

    const records = await prisma.userPermission.findMany({
      where: { userId: user.id },
      select: { permission: true, enabled: true },
    });
    const permissions = createPermissionMap(DEFAULT_USER_PERMISSIONS);
    for (const record of records) {
      permissions[record.permission] = record.enabled;
    }
    return NextResponse.json({ success: true, userId: user.id, role: "USER", permissions }, {
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
    if (isAdminEmail(user.email)) {
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
    if (
      !values ||
      typeof values !== "object" ||
      Array.isArray(values) ||
      PERMISSIONS.some((permission) => typeof values[permission] !== "boolean") ||
      Object.keys(values).some((permission) => !PERMISSIONS.includes(permission))
    ) {
      return NextResponse.json(
        { success: false, error: "Provide a boolean value for every supported permission." },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      PERMISSIONS.map((permission) =>
        prisma.userPermission.upsert({
          where: { userId_permission: { userId: user.id, permission } },
          create: { userId: user.id, permission, enabled: values[permission] },
          update: { enabled: values[permission] },
        })
      )
    );
    return NextResponse.json({
      success: true,
      role: "USER",
      permissions: values,
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