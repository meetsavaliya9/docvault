import { NextResponse } from "next/server";
import { getAdminEmails, isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { getConfiguredManagerEmail } from "@/lib/managerConfig";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const configuredEmail = getConfiguredManagerEmail();
  if (!configuredEmail) {
    return NextResponse.json({
      configuredEmail: null,
      manager: null,
      configurationError: "Set MANAGER_EMAIL to configure the Manager account.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (isAdminEmail(configuredEmail)) {
    return NextResponse.json({
      configuredEmail,
      manager: null,
      configurationError: "MANAGER_EMAIL must not also be an administrator email.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const account = await prisma.user.findUnique({
      where: { email: configuredEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBlocked: true,
        createdAt: true,
      },
    });
    const adminEmails = getAdminEmails();
    const activeUserCount = account
      ? await prisma.user.count({
          where: {
            role: "USER",
            isBlocked: false,
            ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
          },
        })
      : 0;

    return NextResponse.json({
      configuredEmail,
      manager: account
        ? {
            id: account.id,
            email: account.email,
            name: account.name,
            role: account.role,
            isBlocked: account.isBlocked,
            createdAt: account.createdAt,
            accessibleUserCount: activeUserCount,
          }
        : null,
      configurationError: null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin configured Manager lookup failed:", {
      name: error?.name,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Could not load the configured Manager account." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
