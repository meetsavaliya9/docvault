import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";

const RAZORPAY_API_URL = "https://api.razorpay.com/v1";
let razorpayClient;

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return { keyId, keySecret };
}

export function getRazorpayClient() {
  const { keyId, keySecret } = getRazorpayCredentials();
  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayClient;
}

export function getRazorpayPlanId(planKey) {
  if (planKey === "plus") return process.env.RAZORPAY_PLUS_MONTHLY_PLAN_ID?.trim() || null;
  if (planKey === "pro") return process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID?.trim() || null;
  return null;
}

export async function razorpayRequest(path, { method = "GET", body } = {}) {
  const { keyId, keySecret } = getRazorpayCredentials();
  const response = await fetch(`${RAZORPAY_API_URL}${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const result = await response.json();
  if (!response.ok) {
    const message =
      (typeof result.error === "string" ? result.error : null) ||
      result.error?.description ||
      result.error?.reason ||
      `Razorpay API request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.code = typeof result.error === "object" ? result.error?.code : null;
    throw error;
  }
  return result;
}

function signaturesMatch(expected, received) {
  if (typeof received !== "string" || !/^[a-f\d]{64}$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyRazorpayCheckoutSignature(paymentId, subscriptionId, signature) {
  const { keySecret } = getRazorpayCredentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return signaturesMatch(expected, signature);
}

export function verifyRazorpayPaymentSignature(orderId, paymentId, signature) {
  const { keySecret } = getRazorpayCredentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return signaturesMatch(expected, signature);
}

export function verifyRazorpayWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured.");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signaturesMatch(expected, signature);
}

export async function syncRazorpaySubscription(subscription, knownUserId = null) {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true, cancelAtPeriodEnd: true },
  });
  const userId =
    subscription.notes?.dv_user_id ||
    knownUserId ||
    existing?.userId;
  if (!userId) {
    throw new Error(`No DocVault account matches Razorpay subscription ${subscription.id}.`);
  }

  const configuredPlan = await prisma.razorpayPlan.findUnique({
    where: { providerPlanId: subscription.plan_id },
    select: { planKey: true },
  });
  const planKey =
    configuredPlan?.planKey ||
    ["plus", "pro"].find((key) => getRazorpayPlanId(key) === subscription.plan_id);
  if (!planKey) {
    throw new Error(`Razorpay plan ${subscription.plan_id} is not configured for DocVault.`);
  }

  const status = ["authenticated", "resumed"].includes(subscription.status)
    ? "active"
    : subscription.status;
  const currentPeriodEnd = Number.isFinite(subscription.current_end)
    ? new Date(subscription.current_end * 1000)
    : null;
  const cancelAtPeriodEnd =
    subscription.status === "cancelled" ||
    subscription.status === "completed" ||
    (subscription.has_scheduled_changes === true && subscription.change_scheduled_at != null) ||
    existing?.cancelAtPeriodEnd === true;

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId,
      provider: "razorpay",
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.plan_id,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
    update: {
      userId,
      provider: "razorpay",
      stripePriceId: subscription.plan_id,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    },
  });
  return { userId, planKey };
}
