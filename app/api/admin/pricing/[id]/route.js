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
    (plan.slug !== "free" && body.price === 0) ||
    (plan.slug === "free" && body.price !== 0)
  ) {
    return plan.slug === "free"
      ? "The Free plan price must be zero."
      : "Paid plan price must be a positive whole number of currency minor units.";
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
    body.features.length > 30 ||
    body.features.some(
      (feature) =>
        typeof feature !== "string" ||
        !feature.trim() ||
        feature.trim().length > 120
    )
  ) {
    return "Enter up to 30 non-empty features, each at most 120 characters.";
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
    };
    const validationError = validatePlanUpdate(plan, update);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      if (update.isRecommended) {
        await transaction.subscriptionPlan.updateMany({
          where: { isRecommended: true, id: { not: id } },
          data: { isRecommended: false },
        });
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
    console.error("Could not update subscription plan:", error);
    return NextResponse.json(
      { error: "Could not save this plan. Please try again." },
      { status: 500 }
    );
  }
}
