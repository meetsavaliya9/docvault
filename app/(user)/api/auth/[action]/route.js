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
  resendLoginOtp,
  sendSignupOtp,
  resendSignupOtp,
  verifyLoginOtp,
  verifySignupOtp,
} from "@/app/lib/auth/emailOtp";
import {
  createAdminSession,
  destroyAdminSession,
} from "@/lib/auth/admin";
import { getUserPermissions, getUserRole } from "@/lib/permissions";
import {
  logSafeServerError,
  logSignupError,
  runSignupDatabaseOperation,
} from "@/lib/auth/errorDiagnostics";

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

    return NextResponse.json({
      user: {
        ...user,
        role: getUserRole(user),
        permissions: await getUserPermissions(user),
      },
    }, { headers: { "Cache-Control": "no-store" } });
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
  let diagnosticSecrets = [];
  const isSignupAction = action === "signup" || action === "send-otp";

  try {
    if (isSignupAction) console.log("[SIGNUP] started");

    if (action === "logout") {
      await destroySession();
      await destroyAdminSession();
      return NextResponse.json({ success: true });
    }

    const allowedActions = ["signup", "send-otp", "resend-otp", "verify-otp", "login"];
    if (!allowedActions.includes(action)) {
      return errorResponse("Not found.", 404);
    }

    let body;
    try {
      if (isSignupAction) console.log("[SIGNUP] request parsing started");
      body = await request.json();
      if (isSignupAction) console.log("[SIGNUP] request parsing completed");
    } catch (error) {
      if (isSignupAction) {
        logSignupError(error, { secrets: diagnosticSecrets });
      }
      return errorResponse("Request body must be valid JSON.", 400);
    }
    diagnosticSecrets = [
      body?.email,
      body?.password,
      body?.confirmPassword,
      body?.otp,
      body?.code,
    ].filter((value) => typeof value === "string");

    // 1. Send OTP for Signup / Create Account
    if (action === "signup" || action === "send-otp") {
      console.log("[SIGNUP] signup handler started");
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
      const email = typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
      const account = email
        ? await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isBlocked: true,
            },
          })
        : null;

      if (account && getUserRole(account) !== "USER") {
        return errorResponse("OTP resend is only available for user accounts.", 403);
      }

      const result = account
        ? await resendLoginOtp(account)
        : await resendSignupOtp(body?.email);
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
      const pending = await runSignupDatabaseOperation(
        "OTP verification pending-record lookup",
        () =>
          prisma.emailVerification.findUnique({
            where: { email },
          })
      );

      if (pending) {
        // Pending signup: verify OTP and create account only if valid
        const result = await verifySignupOtp(email, code);
        if (result.error) {
          return errorResponse(result.error, result.status || 400);
        }

        // Account is now created in MySQL! Create session and log the user in.
        await destroyAdminSession();
        await createSession(result.user);
        return NextResponse.json({
          success: true,
          message: "Email verified successfully.",
          user: result.user,
          redirectTo: "/dashboard/subscription",
        });
      }

      // If no pending signup, check if this is an existing user sign-in 2FA
      const account = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true },
      });
      if (account && getUserRole(account) !== "USER") {
        return errorResponse("OTP verification is only available for user accounts.", 403);
      }

      const result = await verifyLoginOtp(email, code);
      if (result.error) {
        return errorResponse(result.error, result.status || 400);
      }

      await destroyAdminSession();
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

      const role = getUserRole(user);
      if (role === "ADMIN") {
        await destroySession();
        await destroyAdminSession();
        await createSession(user);
        await createAdminSession(user);
        return NextResponse.json({
          success: true,
          redirectTo: "/admin",
        });
      }

      if (role === "MANAGER") {
        await destroySession();
        await destroyAdminSession();
        await createSession(user);
        return NextResponse.json({
          success: true,
          redirectTo: "/manager",
        });
      }

      await destroyAdminSession();
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
    logSafeServerError(
      action === "signup" || action === "send-otp"
        ? "AUTH SIGNUP ACTION FAILED"
        : `AUTH ACTION FAILED [${action}]`,
      error,
      { secrets: diagnosticSecrets }
    );
    if (isSignupAction) {
      logSignupError(error, { secrets: diagnosticSecrets });
    }

    // The actual exception is logged above, before applying a fallback code.
    const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
    const msg = typeof error === "string" ? error : error?.message || "";
    const combined = `${code} ${msg}`.toLowerCase();

    let publicMessage = "Could not complete the request. Please try again.";

    if (code === "SMTP_AUTH_FAILED" || combined.includes("smtp_auth_failed") || code === "EAUTH") {
      publicMessage =
        "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD; for Gmail, use a Google App Password, not your regular account password.";
    } else if (
      code === "SMTP_CONFIG_ERROR" ||
      code === "SMTP_TLS_CERTIFICATE_ERROR" ||
      code === "SMTP_CONNECTION_TIMEOUT" ||
      code === "SMTP_CONNECTION_FAILED" ||
      code === "SMTP_ADDRESS_REJECTED" ||
      msg.startsWith("SMTP is not configured") ||
      msg.includes("SMTP settings still contain example placeholder values")
    ) {
      publicMessage = msg || "SMTP configuration is invalid. Check your environment settings.";
    } else if (code === "SMTP_SEND_FAILED" || msg.includes("Could not send verification email")) {
      publicMessage = msg || "Could not send verification email. Please check your SMTP settings and try again.";
    } else if (
      msg.includes("DATABASE_URL") ||
      combined.includes("database_url") ||
      combined.includes("prisma") ||
      combined.includes("econnrefused") ||
      combined.includes("enotfound") ||
      combined.includes("er_access_denied_error") ||
      combined.includes("connect econnrefused") ||
      code.startsWith("P") ||
      /^E[A-Z_]+$/.test(code)
    ) {
      publicMessage = "Database error. Please check MySQL connection and migrations.";
    } else if (msg) {
      publicMessage = msg;
    }

    return errorResponse(publicMessage, 500);
  }
}
