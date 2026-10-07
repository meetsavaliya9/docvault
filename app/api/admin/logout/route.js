import { NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/auth/admin";

export const runtime = "nodejs";

export async function POST() {
  await destroyAdminSession();
  return NextResponse.json({ success: true, message: "Admin signed out." });
}
