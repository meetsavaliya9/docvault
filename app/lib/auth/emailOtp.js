import "server-only";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_PERMISSIONS } from "@/lib/permissionConstants";
import { hashPassword, validateSignupData } from "./session";
import { sendVerificationOtp, validateSmtpConfig } from "@/lib/email";
import { logSafeServerError, runSignupDatabaseOperation } from "@/lib/auth/errorDiagnostics";

export { sendVerificationOtp, validateSmtpConfig };

const OTP_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes
const OTP_COOLDOWN_MS = 60 * 1000;      // 60 seconds resend cooldown
const MAX_OTP_ATTEMPTS = 5;

function getOtpSecret() {
  const secret = process.env.OTP_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  return "docvault_default_secure_otp_secret_key_32chars";
}

/**
 * Generates an HMAC-SHA256 hash of the email and OTP code.
 * Scoping to the email prevents cross-email OTP reuse.
 */
export function hashOtp(email, code) {
  const secret = getOtpSecret();
  return createHmac("sha256", secret)
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}

/**
 * Validates signup credentials, checks if the email is already registered,
 * creates or updates the pending EmailVerification record, and sends a 6-digit OTP via Gmail SMTP.
 *
 * NOTE: The User record is NEVER created here.
 */
export async function sendSignupOtp({ name, email, password, confirmPassword }) {
  console.log("[SIGNUP] input validation started");
  // 1. Validate all signup inputs
  const validationError = validateSignupData({ name, email, password, confirmPassword });
  if (validationError) {
    console.log("[SIGNUP] input validation failed");
    return { error: validationError, status: 400 };
  }
  console.log("[SIGNUP] input validation completed");

  const normalizedEmail = email.trim().toLowerCase();
  const diagnosticSecrets = [normalizedEmail, password, confirmPassword];

  console.log("[SIGNUP] checking database");
  await runSignupDatabaseOperation(
    "database connection",
    () => prisma.$connect(),
    { secrets: diagnosticSecrets }
  );

  // 2. Check if an account already exists in MySQL
  console.log("[SIGNUP] user lookup started");
  const existingUser = await runSignupDatabaseOperation(
    "existing-user lookup",
    () =>
      prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }),
    { secrets: diagnosticSecrets }
  );
  console.log("[SIGNUP] user lookup completed");
  if (existingUser) {
    return { error: "An account with this email already exists.", status: 409 };
  }

  // 3. Check for existing pending verification and enforce resend cooldown
  console.log("[SIGNUP] pending OTP lookup started");
  const existingPending = await runSignupDatabaseOperation(
    "pending-email-verification lookup",
    () =>
      prisma.emailVerification.findUnique({
        where: { email: normalizedEmail },
      }),
    { secrets: diagnosticSecrets }
  );
  console.log("[SIGNUP] pending OTP lookup completed");

  if (existingPending) {
    const elapsed = Date.now() - new Date(existingPending.lastSentAt).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      return {
        error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
        status: 429,
        retryAfter: remainingSeconds,
      };
    }
  }

  // 4. Validate SMTP configuration before touching database
  console.log("[SIGNUP] SMTP config check", {
    host: !!process.env.SMTP_HOST,
    port: !!process.env.SMTP_PORT,
    user: !!process.env.SMTP_USER,
    password: !!process.env.SMTP_PASSWORD,
    from: !!process.env.SMTP_FROM,
  });
  const smtpCheck = validateSmtpConfig();
  if (!smtpCheck.ok) {
    console.error("Signup API error: SMTP configuration invalid:", smtpCheck.error);
    return { error: smtpCheck.error, status: 500 };
  }

  // 5. Generate cryptographically secure 6-digit OTP
  console.log("[SIGNUP] OTP generation started");
  const otp = String(randomInt(100000, 1000000));
  const otpHash = hashOtp(normalizedEmail, otp);
  console.log("[SIGNUP] password hashing started");
  const passwordHash = await hashPassword(password);
  console.log("[SIGNUP] password hashing completed");
  const expiresAt = new Date(Date.now() + OTP_LIFETIME_MS);
  console.log("[SIGNUP] OTP generation completed");

  // 6. Store or update pending verification record in MySQL
  await runSignupDatabaseOperation("pending OTP creation/update", () =>
    prisma.emailVerification.upsert({
      where: { email: normalizedEmail },
      create: {
        id: randomUUID(),
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        name: name.trim(),
        passwordHash,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    { secrets: [...diagnosticSecrets, passwordHash, otp, otpHash] }
  );

  // 7. Send OTP via Gmail SMTP
  try {
    console.log("[SIGNUP] email sending started");
    await sendVerificationOtp(normalizedEmail, otp, {
      name: name.trim(),
      expiryMinutes: 10,
      operation: "signup",
    });
    console.log("[SIGNUP] email sending completed");
  } catch (mailError) {
    logSafeServerError("Signup email delivery failed", mailError, {
      secrets: [process.env.SMTP_USER, normalizedEmail],
    });

    // If sending fails, delete the pending record so user can retry cleanly
    try {
      await runSignupDatabaseOperation("pending OTP cleanup after email failure", () =>
        prisma.emailVerification.delete({ where: { email: normalizedEmail } })
      );
    } catch (cleanupError) {
      logSafeServerError("Signup pending OTP cleanup failed", cleanupError, {
        secrets: [process.env.SMTP_USER, normalizedEmail],
      });
    }
    return {
      error: mailError.message || "Failed to send verification email.",
      status: 500,
    };
  }

  // Safe success response - NEVER return OTP or log it
  return {
    success: true,
    message: "Verification OTP sent to your email.",
    email: normalizedEmail,
    expiresInSeconds: OTP_LIFETIME_MS / 1000,
    cooldownSeconds: OTP_COOLDOWN_MS / 1000,
  };
}

/**
 * Resends a new OTP for an existing pending signup verification.
 * Enforces a 60-second cooldown and replaces the previous OTP.
 */
export async function resendSignupOtp(email) {
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email address is required.", status: 400 };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check if email is already a registered user
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) {
    return { error: "An account with this email already exists.", status: 409 };
  }

  // 2. Check that a pending verification exists
  const pending = await prisma.emailVerification.findUnique({
    where: { email: normalizedEmail },
  });
  if (!pending) {
    return {
      error: "No pending verification found for this email. Please fill out the signup form first.",
      status: 404,
    };
  }

  // 3. Enforce cooldown
  const elapsed = Date.now() - new Date(pending.lastSentAt).getTime();
  if (elapsed < OTP_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
    return {
      error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      status: 429,
      retryAfter: remainingSeconds,
    };
  }

  // 4. Check SMTP
  const smtpCheck = validateSmtpConfig();
  if (!smtpCheck.ok) {
    return { error: smtpCheck.error, status: 500 };
  }

  // 5. Generate brand new 6-digit OTP (invalidates old OTP)
  const otp = String(randomInt(100000, 1000000));
  const otpHash = hashOtp(normalizedEmail, otp);
  const expiresAt = new Date(Date.now() + OTP_LIFETIME_MS);

  await prisma.emailVerification.update({
    where: { id: pending.id },
    data: {
      otpHash,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
  });

  // 6. Send email
  try {
    await sendVerificationOtp(normalizedEmail, otp, {
      name: pending.name,
      expiryMinutes: 10,
    });
  } catch (mailError) {
    return {
      error: mailError.message || "Failed to send verification email.",
      status: 500,
    };
  }

  return {
    success: true,
    message: "A new verification OTP has been sent to your email.",
    cooldownSeconds: OTP_COOLDOWN_MS / 1000,
  };
}

export async function resendLoginOtp(user) {
  if (!user?.id || !user.email || user.role !== "USER") {
    return { error: "OTP resend is only available for user accounts.", status: 403 };
  }
  if (user.isBlocked) {
    return { error: "This account is blocked.", status: 403 };
  }

  const latestChallenge = await prisma.otpChallenge.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latestChallenge) {
    return {
      error: "No sign-in verification is pending. Please sign in again.",
      status: 404,
    };
  }

  const elapsed = Date.now() - latestChallenge.createdAt.getTime();
  if (elapsed < OTP_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
    return {
      error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      status: 429,
      retryAfter: remainingSeconds,
    };
  }

  const result = await sendLoginOtp(user);
  return {
    success: true,
    message: "A new sign-in OTP has been sent to your email.",
    cooldownSeconds: OTP_COOLDOWN_MS / 1000,
    expiresInSeconds: result.expiresInSeconds,
  };
}

/**
 * Verifies the OTP entered by the user.
 * ONLY upon successful verification, creates the actual User record in MySQL via Prisma transaction.
 * If OTP is invalid, expired, or attempts exceeded, the account is NEVER created.
 */
export async function verifySignupOtp(email, code) {
  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof code !== "string" ||
    !/^\d{6}$/.test(code.trim())
  ) {
    return { error: "Enter the 6-digit verification code sent to your email.", status: 400 };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Fetch pending record
  const pending = await prisma.emailVerification.findUnique({
    where: { email: normalizedEmail },
  });

  if (!pending) {
    return {
      error: "No pending verification found or it has expired. Please sign up again.",
      status: 400,
    };
  }

  // 2. Check expiration
  if (pending.expiresAt <= new Date()) {
    await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {});
    return {
      error: "The verification code has expired. Please request a new OTP.",
      status: 400,
    };
  }

  // 3. Check attempt limit
  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {});
    return {
      error: "Too many incorrect attempts. Please sign up again or request a new code.",
      status: 400,
    };
  }

  // 4. Compare hash with timing-safe comparison
  const expectedHash = Buffer.from(pending.otpHash, "hex");
  const actualHash = Buffer.from(hashOtp(normalizedEmail, code.trim()), "hex");

  const isValid =
    expectedHash.length === actualHash.length &&
    expectedHash.length > 0 &&
    timingSafeEqual(expectedHash, actualHash);

  if (!isValid) {
    const updatedAttempts = pending.attempts + 1;
    await prisma.emailVerification.update({
      where: { id: pending.id },
      data: { attempts: updatedAttempts },
    });

    const remaining = MAX_OTP_ATTEMPTS - updatedAttempts;
    return {
      error:
        remaining > 0
          ? `The verification code is incorrect. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "The verification code is incorrect. No attempts remaining. Please request a new OTP.",
      status: 400,
    };
  }

  // 5. SUCCESS: ONLY NOW create the actual User record in MySQL using a safe transaction!
  try {
    const [newUser] = await runSignupDatabaseOperation(
      "verified-account creation and OTP deletion transaction",
      () =>
        prisma.$transaction([
          prisma.user.create({
            data: {
              id: randomUUID(),
              email: normalizedEmail,
              name: pending.name || null,
              passwordHash: pending.passwordHash,
              userPermissions: {
                create: DEFAULT_USER_PERMISSIONS.map((permission) => ({
                  id: randomUUID(),
                  permission,
                  enabled: true,
                })),
              },
              subscriptions: {
                create: {
                  id: randomUUID(),
                  provider: "internal",
                  planKey: "FREE",
                  planId: "FREE",
                  status: "active",
                  startDate: new Date(),
                  updatedAt: new Date(),
                },
              },
            },
            select: { id: true, email: true, name: true, role: true },
          }),
          prisma.emailVerification.delete({
            where: { id: pending.id },
          }),
        ]),
      { secrets: [normalizedEmail, code, pending.passwordHash, pending.otpHash] }
    );

    return { success: true, user: newUser };
  } catch (error) {
    if (error.code === "P2002") {
      return { error: "An account with this email already exists.", status: 409 };
    }
    throw error;
  }
}

/**
 * Preserved for existing user sign-in 2FA (if used).
 */
export async function sendLoginOtp(user) {
  if (!user?.id || user.role !== "USER") {
    const error = new Error("Login OTP is only available for user accounts.");
    error.code = "OTP_USER_ONLY";
    throw error;
  }

  const smtpCheck = validateSmtpConfig();
  if (!smtpCheck.ok) {
    const error = new Error(smtpCheck.error);
    error.code = "SMTP_CONFIG_ERROR";
    throw error;
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_LIFETIME_MS);

  await prisma.otpChallenge.deleteMany({ where: { userId: user.id } });
  const challenge = await prisma.otpChallenge.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      codeHash: hashOtp(user.email, code),
      expiresAt,
    },
    select: { id: true },
  });

  try {
    await sendVerificationOtp(user.email, code, {
      name: user.name,
      expiryMinutes: 10,
    });
  } catch (error) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw error;
  }

  return { expiresInSeconds: OTP_LIFETIME_MS / 1000 };
}

/**
 * Preserved for existing user sign-in 2FA verification (if used).
 */
export async function verifyLoginOtp(email, code) {
  if (typeof email !== "string" || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    return { error: "Enter the 6-digit code sent to your email.", status: 400 };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, role: true, isBlocked: true },
  });
  if (!user || user.isBlocked) {
    return { error: "The verification code is invalid or expired.", status: 400 };
  }
  if (user.role !== "USER") {
    return { error: "OTP verification is only available for user accounts.", status: 403 };
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (
    !challenge ||
    challenge.expiresAt <= new Date() ||
    challenge.attempts >= MAX_OTP_ATTEMPTS
  ) {
    if (challenge) {
      await prisma.otpChallenge.deleteMany({ where: { userId: user.id } });
    }
    return {
      error: "The verification code has expired or reached its attempt limit. Please sign in again.",
      status: 400,
    };
  }

  const expected = Buffer.from(challenge.codeHash, "hex");
  const received = Buffer.from(hashOtp(user.email, code.trim()), "hex");

  if (
    expected.length !== received.length ||
    expected.length === 0 ||
    !timingSafeEqual(expected, received)
  ) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { error: "The verification code is incorrect.", status: 400 };
  }

  await prisma.otpChallenge.deleteMany({ where: { userId: user.id } });
  return { user };
}
