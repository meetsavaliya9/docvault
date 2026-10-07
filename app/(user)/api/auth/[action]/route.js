import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateAccount,
  createSession,
  destroySession,
  getAuthenticatedUser,
  validateCredentials,
} from "@/app/lib/auth/session";
import {
  sendLoginOtp,
  sendSignupOtp,
  resendSignupOtp,
  verifyLoginOtp,
  verifySignupOtp,
} from "@/app/lib/auth/emailOtp";
import { createAdminSession, isAdminEmail } from "@/lib/auth/admin";

export const runtime = "nodejs";

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message, success: false }, { status });
}

export async function GET(_request, { params }) {
  const { action } = await params;
  if (action !== "session") {
    return errorResponse("Not found.", 404);
  }

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return errorResponse("You are not signed in.", 401);
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Could not read the session from MySQL:", error);
    return errorResponse(
      "Could not connect to MySQL. Verify DATABASE_URL and run the Prisma migration.",
      500
    );
  }
}

export async function POST(request, { params }) {
  const { action } = await params;

  try {
    if (action === "logout") {
      await destroySession();
      return NextResponse.json({ success: true });
    }

    const allowedActions = ["signup", "send-otp", "resend-otp", "verify-otp", "login"];
    if (!allowedActions.includes(action)) {
      return errorResponse("Not found.", 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Request body must be valid JSON.", 400);
    }

    // 1. Send OTP for Signup / Create Account
    if (action === "signup" || action === "send-otp") {
      const result = await sendSignupOtp({
        name: body?.name,
        email: body?.email,
        password: body?.password,
        confirmPassword: body?.confirmPassword,
      });

      if (result.error) {
        return errorResponse(result.error, result.status || 400);
      }

      return NextResponse.json(
        {
          success: true,
          otpRequired: true,
          message: result.message,
          email: result.email,
          expiresInSeconds: result.expiresInSeconds,
          cooldownSeconds: result.cooldownSeconds,
        },
        { status: 200 }
      );
    }

    // 2. Resend OTP for pending Signup
    if (action === "resend-otp") {
      const result = await resendSignupOtp(body?.email);
      if (result.error) {
        return errorResponse(result.error, result.status || 400);
      }

      return NextResponse.json(
        {
          success: true,
          message: result.message,
          cooldownSeconds: result.cooldownSeconds,
        },
        { status: 200 }
      );
    }

    // 3. Verify OTP
    if (action === "verify-otp") {
      const email = body?.email ? String(body.email).trim().toLowerCase() : "";
      const code = String(body?.otp || body?.code || "").trim();

      if (!email || !code) {
        return errorResponse("Email and 6-digit OTP code are required.", 400);
      }

      // Check if there is a pending signup verification for this email
      const pending = await prisma.emailVerification.findUnique({
        where: { email },
      });

      if (pending) {
        // Pending signup: verify OTP and create account only if valid
        const result = await verifySignupOtp(email, code);
        if (result.error) {
          return errorResponse(result.error, result.status || 400);
        }

        // Account is now created in MySQL! Create session and log the user in.
        await createSession(result.user);
        return NextResponse.json({
          success: true,
          message: "Email verified successfully.",
          user: result.user,
          redirectTo: "/dashboard/subscription",
        });
      }

      // If no pending signup, check if this is an existing user sign-in 2FA
      const result = await verifyLoginOtp(email, code);
      if (result.error) {
        return errorResponse(result.error, result.status || 400);
      }

      await createSession(result.user);
      return NextResponse.json({
        success: true,
        message: "Verified successfully.",
        user: result.user,
        redirectTo: "/dashboard",
      });
    }

    // 4. Login flow
    if (action === "login") {
      const validationError = validateCredentials(body?.email, body?.password);
      if (validationError) {
        return errorResponse(validationError, 400);
      }

      const email = body.email.trim().toLowerCase();
      const user = await authenticateAccount(email, body.password);
      if (!user) {
        return errorResponse("Email or password is incorrect.", 401);
      }

      if (isAdminEmail(email)) {
        await createAdminSession(user);
        return NextResponse.json({
          success: true,
          redirectTo: "/admin",
        });
      }

      const otp = await sendLoginOtp(user);
      return NextResponse.json({
        success: true,
        otpRequired: true,
        email: user.email,
        expiresInSeconds: otp.expiresInSeconds,
      });
    }

    return errorResponse("Not found.", 404);
  } catch (error) {
    console.error("Auth action failed:", error);

    const msg = error.message || "";
    let publicMessage = "Could not complete the request. Please try again.";

    if (error.code === "SMTP_AUTH_FAILED" || msg.includes("SMTP_AUTH_FAILED") || error.code === "EAUTH") {
      publicMessage =
        "Gmail rejected the SMTP login. Check SMTP_USER and SMTP_PASSWORD; for Gmail, use a Google App Password for that account, not its regular password.";
    } else if (error.code === "SMTP_CONFIG_ERROR" || msg.startsWith("SMTP is not configured") || msg.includes("credentials in .env.local are still set to placeholder")) {
      publicMessage = msg;
    } else if (error.code === "SMTP_SEND_FAILED" || msg.includes("Could not send verification email")) {
      publicMessage = "Could not send verification email. Please check your SMTP settings and try again.";
    } else if (msg.includes("DATABASE_URL") || error.code?.startsWith("P")) {
      publicMessage = "Database error. Please check MySQL connection and migrations.";
    }

    return errorResponse(publicMessage, 500);
  }
}
