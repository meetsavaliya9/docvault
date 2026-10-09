import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { getConfiguredManagerEmail } from "@/lib/managerConfig";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id: userId } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const managerId = body?.managerId;
  if (
    managerId !== null &&
    (typeof managerId !== "string" || managerId.length === 0 || managerId.length > 191)
  ) {
    return NextResponse.json(
      { error: "Provide a valid manager ID or null to unassign." },
      { status: 400 },
    );
  }

  try {
    const manager = await prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, isBlocked: true },
      });
      if (
        !targetUser ||
        targetUser.role !== "USER" ||
        targetUser.isBlocked ||
        isAdminEmail(targetUser.email)
      ) {
        throw new Error("INVALID_TARGET_USER");
      }

      const assignedManager = managerId
        ? await tx.user.findUnique({
            where: { id: managerId },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isBlocked: true,
            },
          })
        : null;
      if (
        managerId &&
        (!assignedManager ||
          assignedManager.role !== "MANAGER" ||
          assignedManager.isBlocked ||
          assignedManager.email.trim().toLowerCase() !== getConfiguredManagerEmail() ||
          isAdminEmail(assignedManager.email))
      ) {
        throw new Error("INVALID_MANAGER");
      }

      if (managerId) {
        await tx.managerAssignment.upsert({
          where: { userId },
          create: { id: randomUUID(), managerId, userId },
          update: { managerId },
        });
      } else {
        await tx.managerAssignment.deleteMany({ where: { userId } });
      }
      return assignedManager;
    });

    return NextResponse.json(
      {
        success: true,
        manager: manager
          ? { id: manager.id, name: manager.name, email: manager.email }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error.message === "INVALID_TARGET_USER") {
      return NextResponse.json(
        { error: "Only active regular user accounts can be assigned to a manager." },
        { status: 400 },
      );
    }
    if (error.message === "INVALID_MANAGER") {
      return NextResponse.json(
        { error: "Choose an active Manager account." },
        { status: 400 },
      );
    }
    console.error("Admin manager assignment update failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not update the user's manager assignment." },
      { status: 500 },
    );
  }
}
