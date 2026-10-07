import { NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { deletePrivateAsset } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { user: adminUser, response } = await requireAdmin();
  if (response) return response;

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const hasBlockStatus = Object.hasOwn(body || {}, "isBlocked");
  const updatesBlockStatus = hasBlockStatus && typeof body.isBlocked === "boolean";
  const updatesPlan = Object.hasOwn(body || {}, "subscriptionPlan");
  const requestedPlan = typeof body?.subscriptionPlan === "string"
    ? body.subscriptionPlan.trim()
    : "";
  if (
    (!updatesBlockStatus && !updatesPlan) ||
    (hasBlockStatus && !updatesBlockStatus) ||
    (updatesPlan && (!requestedPlan || requestedPlan.length > 40))
  ) {
    return NextResponse.json(
      { error: "Provide a valid isBlocked boolean or subscription plan slug." },
      { status: 400 }
    );
  }

  if (adminUser.id === targetUserId) {
    return NextResponse.json(
      { error: "You cannot modify your own administrator account." },
      { status: 400 }
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const selectedPlan = updatesPlan
      ? await prisma.subscriptionPlan.findUnique({
          where: { slug: requestedPlan },
        })
      : null;
    if (updatesPlan && !selectedPlan) {
      return NextResponse.json(
        { error: "Subscription plan was not found." },
        { status: 404 }
      );
    }

    if ((updatesBlockStatus || updatesPlan) && isAdminEmail(targetUser.email)) {
      return NextResponse.json(
        { error: "Administrator accounts cannot be modified from user management." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (updatesBlockStatus) {
        await tx.user.update({
          where: { id: targetUserId },
          data: { isBlocked: body.isBlocked },
        });

        if (body.isBlocked) {
          await tx.session.deleteMany({ where: { userId: targetUserId } });
          await tx.otpChallenge.deleteMany({ where: { userId: targetUserId } });
        }
      }

      if (updatesPlan) {
        const paidSubscription = await tx.subscription.findFirst({
          where: {
            userId: targetUserId,
            provider: { in: ["stripe", "razorpay"] },
            status: { in: ["active", "trialing"] },
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
          },
          select: { id: true },
        });
        if (paidSubscription) {
          throw new Error("PAYMENT_SUBSCRIPTION_ACTIVE");
        }

        await tx.subscription.deleteMany({
          where: {
            userId: targetUserId,
            provider: { in: ["admin", "demo"] },
          },
        });

        if (selectedPlan.price > 0) {
          await tx.subscription.upsert({
            where: { stripeSubscriptionId: `admin_${targetUserId}` },
            create: {
              userId: targetUserId,
              provider: "admin",
              stripeSubscriptionId: `admin_${targetUserId}`,
              stripePriceId: `admin_${selectedPlan.slug}`,
              planKey: selectedPlan.slug,
              planId: selectedPlan.id,
              status: "active",
              currentPeriodEnd: null,
              endDate: null,
            },
            update: {
              userId: targetUserId,
              stripePriceId: `admin_${selectedPlan.slug}`,
              planKey: selectedPlan.slug,
              planId: selectedPlan.id,
              status: "active",
              currentPeriodEnd: null,
              endDate: null,
              cancelAtPeriodEnd: false,
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      ...(updatesBlockStatus ? { isBlocked: body.isBlocked } : {}),
      ...(updatesPlan ? { subscriptionPlan: selectedPlan.slug } : {}),
      message: updatesPlan
        ? `${targetUser.email}'s plan is now ${selectedPlan.name}.`
        : body.isBlocked
          ? `User account ${targetUser.email} has been blocked.`
          : `User account ${targetUser.email} has been unblocked.`,
    });
  } catch (error) {
    if (error.message === "PAYMENT_SUBSCRIPTION_ACTIVE") {
      return NextResponse.json(
        { error: "This account has an active paid subscription. Manage plan changes through the payment provider." },
        { status: 409 }
      );
    }
    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Failed to update user access." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const { user: adminUser, response } = await requireAdmin();
  if (response) return response;

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  // Prevent admin from accidentally deleting their own account via user management
  if (adminUser.id === targetUserId) {
    return NextResponse.json(
      { error: "You cannot delete your own active administrator account." },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        documents: {
          select: {
            id: true,
            cloudinaryPublicId: true,
            cloudinaryResourceType: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Clean up Cloudinary assets
    for (const doc of user.documents) {
      if (doc.cloudinaryPublicId) {
        try {
          await deletePrivateAsset(
            doc.cloudinaryPublicId,
            doc.cloudinaryResourceType || "raw"
          );
        } catch (cloudErr) {
          console.warn(`Could not delete asset ${doc.cloudinaryPublicId} from Cloudinary:`, cloudErr);
        }
      }
    }

    // Delete user from database (cascades all related records)
    await prisma.user.delete({
      where: { id: targetUserId },
    });

    return NextResponse.json({
      success: true,
      message: `User account ${user.email} and all associated files have been permanently deleted.`,
    });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete user account." },
      { status: 500 }
    );
  }
}
