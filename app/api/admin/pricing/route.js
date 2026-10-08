import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/admin";
import {
  BILLING_PERIODS,
  listSubscriptionPlans,
  SUPPORTED_CURRENCIES,
} from "@/lib/subscriptionPlans";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PRICE = 2_000_000_000;
const MAX_STORAGE_BYTES = Number.MAX_SAFE_INTEGER;

function validatePlan(body) {
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 80) {
    return "Plan name is required and must be at most 80 characters.";
  }
  if (!Number.isSafeInteger(body.price) || body.price < 0 || body.price > MAX_PRICE) {
    return "Price must be a non-negative whole number of currency minor units.";
  }
  if (!SUPPORTED_CURRENCIES.includes(body.currency)) {
    return "Choose a supported currency.";
  }
  if (!BILLING_PERIODS.includes(body.billingPeriod)) {
    return "Billing period must be monthly or yearly.";
  }
  if (typeof body.description !== "string" || body.description.trim().length > 500) {
    return "Description must be at most 500 characters.";
  }
  if (
    !Array.isArray(body.features) ||
    body.features.some((feature) =>
      typeof feature !== "string" || !feature.trim() || feature.trim().length > 120
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
    return "Plan active and featured values must be enabled or disabled.";
  }
  if (!Number.isSafeInteger(body.displayOrder) || body.displayOrder < 0 || body.displayOrder > 10000) {
    return "Display order must be a whole number from 0 to 10000.";
  }
  if (
    body.razorpayPlanId !== null &&
    body.razorpayPlanId !== "" &&
    (typeof body.razorpayPlanId !== "string" ||
      !/^plan_[A-Za-z0-9]+$/.test(body.razorpayPlanId.trim()))
  ) {
    return "Razorpay Plan ID must be a valid plan_ identifier or left blank.";
  }
  return null;
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    return NextResponse.json(
      { plans: await listSubscriptionPlans() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Could not load admin subscription plans:", error);
    return NextResponse.json(
      { error: "Could not load pricing settings." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { response } = await requireAdmin();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validationError = validatePlan(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (transaction) => {
      if (body.isRecommended) {
        await transaction.subscriptionPlan.updateMany({
          where: { isRecommended: true },
          data: { isRecommended: false },
        });
      }
      const lastPlan = await transaction.subscriptionPlan.findFirst({
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });
      const id = randomUUID();
      const slugBase = body.name.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 28) || "plan";
      const slug = `${slugBase}-${id.slice(0, 8)}`;

      return transaction.subscriptionPlan.create({
        data: {
          id,
          slug,
          name: body.name.trim(),
          price: body.price,
          currency: body.currency,
          billingPeriod: body.billingPeriod,
          description: body.description.trim(),
          features: JSON.stringify(body.features.map((feature) => feature.trim())),
          documentLimit: body.documentLimit,
          storageLimitBytes: BigInt(body.storageLimitBytes),
          isActive: body.isActive,
          isRecommended: body.isRecommended,
          displayOrder: body.displayOrder ?? (lastPlan?.displayOrder ?? -1) + 1,
          razorpayPlanId: body.razorpayPlanId?.trim() || null,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `${created.name} plan created.`,
      plan: {
        ...created,
        slug: created.slug.toLowerCase(),
        storageLimitBytes: Number(created.storageLimitBytes),
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A plan with that name or Razorpay Plan ID already exists." }, { status: 409 });
    }
    console.error("Could not create subscription plan:", error);
    return NextResponse.json({ error: "Could not create this plan. Please try again." }, { status: 500 });
  }
}
