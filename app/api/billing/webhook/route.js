import { NextResponse } from "next/server";
import { syncRazorpaySubscription, verifyRazorpayWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.completed",
  "subscription.updated",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.paused",
  "subscription.resumed",
]);

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Razorpay webhook signature is missing." }, { status: 400 });
  }

  try {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid Razorpay webhook signature." }, { status: 400 });
    }
  } catch (error) {
    console.error("Razorpay webhook configuration error:", error);
    return NextResponse.json(
      { error: "Razorpay webhook secret is not configured on the server." },
      { status: 503 }
    );
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Razorpay webhook body is not valid JSON." }, { status: 400 });
  }

  if (!SUBSCRIPTION_EVENTS.has(event.event)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const subscription = event.payload?.subscription?.entity;
  if (!subscription?.id) {
    return NextResponse.json(
      { error: "Razorpay subscription event is missing its subscription entity." },
      { status: 400 }
    );
  }

  try {
    await syncRazorpaySubscription(subscription);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Failed to process Razorpay webhook event ${event.event}:`, error);
    return NextResponse.json(
      { error: "Could not process the Razorpay event. It can be retried safely." },
      { status: 500 }
    );
  }
}
