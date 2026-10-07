import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Recurring checkout is retired. Use /api/payment/create-order." },
    { status: 410 }
  );
}
