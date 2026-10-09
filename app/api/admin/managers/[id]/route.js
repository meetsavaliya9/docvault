import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { getConfiguredManagerEmail } from "@/lib/managerConfig";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Manager ID is required." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!["block", "unblock"].includes(body?.action)) {
    return NextResponse.json(
      { error: "Only activation status can be changed here." },
      { status: 400 },
    );
  }

  const managerEmail = getConfiguredManagerEmail();
  if (!managerEmail || isAdminEmail(managerEmail)) {
    return NextResponse.json(
      { error: "The configured Manager account is unavailable." },
      { status: 404 },
    );
  }

  try {
    const manager = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (
      !manager ||
      manager.email.trim().toLowerCase() !== managerEmail ||
      manager.role !== "MANAGER"
    ) {
      return NextResponse.json(
        { error: "The configured Manager account was not found." },
        { status: 404 },
      );
    }

    const isBlocked = body.action === "block";
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { isBlocked },
      });
      if (isBlocked) {
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.otpChallenge.deleteMany({ where: { userId: id } });
      }
    });

    return NextResponse.json({
      success: true,
      isBlocked,
      message: isBlocked
        ? "Manager account deactivated and active sessions revoked."
        : "Manager account activated.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin configured Manager status update failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not update Manager access." },
      { status: 500 },
    );
  }
}
