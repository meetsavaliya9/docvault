import { NextResponse } from "next/server";
import { authenticateAccount, validateCredentials } from "@/app/lib/auth/session";
import { createAdminSession, isAdminEmail } from "@/lib/auth/admin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    const validationError = validateCredentials(email, password);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email is in the admin allowlist first
    if (!isAdminEmail(cleanEmail)) {
      return NextResponse.json(
        { error: "Access denied. This email is not authorized for administrator access." },
        { status: 403 }
      );
    }

    const user = await authenticateAccount(cleanEmail, password);
    if (!user) {
      return NextResponse.json(
        { error: "Incorrect admin credentials. Please check your password." },
        { status: 401 }
      );
    }

    await createAdminSession(user);

    return NextResponse.json({
      success: true,
      message: "Admin authenticated successfully.",
      user: { id: user.id, email: user.email, name: user.name },
      redirectTo: "/admin",
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during admin sign-in." },
      { status: 500 }
    );
  }
}
