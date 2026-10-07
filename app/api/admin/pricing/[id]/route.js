import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  BILLING_PERIODS,
  getSubscriptionPlanById,
  SUPPORTED_CURRENCIES,
} from "@/lib/subscriptionPlans";
import { prisma } from "@/lib/prisma";

const MAX_PRICE = 2_000_000_000;
const MAX_STORAGE_BYTES = Number.MAX_SAFE_INTEGER;

function validatePlanUpdate(plan, body) {
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 80) {
    return "Plan name is required and must be at most 80 characters.";
  }
  if (
    !Number.isSafeInteger(body.price) ||
    body.price < 0 ||
    body.price > MAX_PRICE ||
    ((plan.id === "FREE" || plan.slug.toLowerCase() === "free") && body.price !== 0)
  ) {
    return plan.id === "FREE" || plan.slug.toLowerCase() === "free"
      ? "The Free plan price must be zero."
      : "Price must be a non-negative whole number of currency minor units.";
  }
  if (!SUPPORTED_CURRENCIES.includes(body.currency)) {
    return "Choose a supported currency.";
  }
  if (!BILLING_PERIODS.includes(body.billingPeriod)) {
    return "Billing period must be monthly or yearly.";
  }
  if (
    typeof body.description !== "string" ||
    body.description.trim().length > 500
  ) {
    return "Description must be at most 500 characters.";
  }
  if (
    !Array.isArray(body.features) ||
    body.features.some(
      (feature) =>
        typeof feature !== "string" ||
        !feature.trim() ||
        feature.trim().length > 120
    )
  ) {
    return "Features must be non-empty text, up to 120 characters each.";
  }
  if (body.price > 0 && body.features.length === 0) {
    return "Add at least one feature to a paid plan.";
  }
  if (
    body.documentLimit !== null &&
    (!Number.isSafeInteger(body.documentLimit) || body.documentLimit < 1)
  ) {
    return "Document limit must be a positive whole number or unlimited.";
  }
  if (
    !Number.isSafeInteger(body.storageLimitBytes) ||
    body.storageLimitBytes < 1 ||
    body.storageLimitBytes > MAX_STORAGE_BYTES
  ) {
    return "Storage limit must be a positive, valid number of bytes.";
  }
  if (typeof body.isActive !== "boolean" || typeof body.isRecommended !== "boolean") {
    return "Plan active and recommended values must be enabled or disabled.";
  }
  if (
    body.razorpayPlanId !== null &&
    body.razorpayPlanId !== "" &&
    (typeof body.razorpayPlanId !== "string" ||
      !/^plan_[A-Za-z0-9]+$/.test(body.razorpayPlanId.trim()))
  ) {
    return "Razorpay Plan ID must be a valid plan_ identifier or left blank.";
  }
  if (!Number.isSafeInteger(body.displayOrder) || body.displayOrder < 0 || body.displayOrder > 10000) {
    return "Display order must be a whole number from 0 to 10000.";
  }
  return null;
}

export async function PATCH(request, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const plan = await getSubscriptionPlanById(id);
    if (!plan) {
      return NextResponse.json({ error: "Subscription plan not found." }, { status: 404 });
    }
    const update = {
      name: Object.hasOwn(body || {}, "name") ? body.name : plan.name,
      price: Object.hasOwn(body || {}, "price") ? body.price : plan.price,
      currency: Object.hasOwn(body || {}, "currency") ? body.currency : plan.currency,
      billingPeriod: Object.hasOwn(body || {}, "billingPeriod")
        ? body.billingPeriod
        : plan.billingPeriod,
      description: Object.hasOwn(body || {}, "description")
        ? body.description
        : plan.description,
      features: Object.hasOwn(body || {}, "features") ? body.features : plan.features,
      documentLimit: Object.hasOwn(body || {}, "documentLimit")
        ? body.documentLimit
        : plan.documentLimit,
      storageLimitBytes: Object.hasOwn(body || {}, "storageLimitBytes")
        ? body.storageLimitBytes
        : plan.storageLimitBytes,
      isActive: Object.hasOwn(body || {}, "isActive") ? body.isActive : plan.isActive,
      isRecommended: Object.hasOwn(body || {}, "isRecommended")
        ? body.isRecommended
        : plan.isRecommended,
      displayOrder: Object.hasOwn(body || {}, "displayOrder")
        ? body.displayOrder
        : plan.displayOrder,
      razorpayPlanId: Object.hasOwn(body || {}, "razorpayPlanId")
        ? body.razorpayPlanId
        : plan.razorpayPlanId,
    };
    const validationError = validatePlanUpdate(plan, update);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    if (
      (plan.id === "FREE" || plan.slug.toLowerCase() === "free") &&
      update.isActive === false
    ) {
      return NextResponse.json(
        { error: "The default Free plan must remain active." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (transaction) => {
      if (update.isRecommended) {
        await transaction.subscriptionPlan.updateMany({
          where: { isRecommended: true, id: { not: id } },
          data: { isRecommended: false },
        });
      }
      if (update.name.trim() !== plan.name) {
        const nameInUse = await transaction.subscriptionPlan.findFirst({
          where: { name: update.name.trim(), id: { not: id } },
          select: { id: true },
        });
        if (nameInUse) throw new Error("PLAN_NAME_CONFLICT");
      }
      return transaction.subscriptionPlan.update({
        where: { id },
        data: {
          name: update.name.trim(),
          price: update.price,
          currency: update.currency,
          billingPeriod: update.billingPeriod,
          description: update.description.trim(),
          features: update.features.map((feature) => feature.trim()),
          documentLimit: update.documentLimit,
          storageLimitBytes: BigInt(update.storageLimitBytes),
          isActive: update.isActive,
          isRecommended: update.isRecommended,
          displayOrder: update.displayOrder,
          razorpayPlanId: update.razorpayPlanId?.trim() || null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `${updated.name} plan saved.`,
      plan: {
        ...plan,
        ...updated,
        slug: updated.slug.toLowerCase(),
        storageLimitBytes: Number(updated.storageLimitBytes),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === "PLAN_NAME_CONFLICT" || error.code === "P2002") {
      return NextResponse.json(
        { error: "A plan with that name or Razorpay Plan ID already exists." },
        { status: 409 }
      );
    }
    console.error("Could not update subscription plan:", error);
    return NextResponse.json(
      { error: "Could not save this plan. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const plan = await transaction.subscriptionPlan.findUnique({
        where: { id },
        select: { id: true, slug: true, name: true },
      });
      if (!plan) return { notFound: true };
      if (plan.id === "FREE" || plan.slug.toLowerCase() === "free") {
        return { cannotDeleteFreePlan: true };
      }

      const [subscriptionCount, paymentCount, razorpayPlanCount, legacyPricingCount] = await Promise.all([
        transaction.subscription.count({
          where: { OR: [{ planId: id }, { planKey: plan.slug }] },
        }),
        transaction.payment.count({
          where: { OR: [{ planId: id }, { plan: plan.slug }] },
        }),
        transaction.razorpayPlan.count({ where: { planKey: plan.slug } }),
        transaction.subscriptionPlanPricing.count({ where: { planKey: plan.slug } }),
      ]);

      if (subscriptionCount > 0 || paymentCount > 0 || razorpayPlanCount > 0 || legacyPricingCount > 0) {
        await transaction.subscriptionPlan.update({
          where: { id },
          data: { isActive: false, isRecommended: false },
        });
        return { archived: true, planName: plan.name };
      }

      await transaction.subscriptionPlan.delete({ where: { id } });
      return { archived: false, planName: plan.name };
    });

    if (result.notFound) {
      return NextResponse.json({ error: "Subscription plan not found." }, { status: 404 });
    }
    if (result.cannotDeleteFreePlan) {
      return NextResponse.json({ error: "The default Free plan cannot be deleted." }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      archived: result.archived,
      message: result.archived
        ? `${result.planName} has existing subscription or payment records, so it was archived instead of deleted.`
        : `${result.planName} plan deleted.`,
    });
  } catch (error) {
    console.error("Could not archive or delete subscription plan:", error);
    return NextResponse.json(
      { error: "Could not remove this plan. Please try again." },
      { status: 500 }
    );
  }
}
