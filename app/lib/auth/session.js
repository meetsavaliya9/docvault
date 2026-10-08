import "server-only";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_PERMISSIONS } from "@/lib/permissionConstants";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "docvault_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_HASH_LENGTH = 64;
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_HASH_LENGTH);
  return `${salt.toString("hex")}:${Buffer.from(derivedKey).toString("hex")}`;
}

export function validateSignupData({ name, email, password, confirmPassword }) {
  if (typeof name !== "string" || !name.trim()) {
    return "Please enter your full name.";
  }
  if (name.trim().length > 120) {
    return "Name cannot exceed 120 characters.";
  }

  const credentialsError = validateCredentials(email, password);
  if (credentialsError) {
    return credentialsError;
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
}

export function validateCredentials(email, password) {
  if (
    typeof email !== "string" ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return "Enter a valid email address.";
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 1024
  ) {
    return "Password must be between 8 and 1024 characters.";
  }

  return null;
}

export async function createAccount(email, passwordOrHash, name = null, isPreHashed = false) {
  const passwordHash = isPreHashed
    ? passwordOrHash
    : await hashPassword(passwordOrHash);

  try {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: email.trim().toLowerCase(),
        name: name ? name.trim() : null,
        passwordHash,
        userPermissions: {
          create: DEFAULT_USER_PERMISSIONS.map((permission) => ({
            id: randomUUID(),
            permission,
            enabled: true,
          })),
        },
        subscriptions: {
          create: {
            provider: "internal",
            planKey: "FREE",
            status: "active",
            startDate: new Date(),
          },
        },
      },
      select: { id: true, email: true, name: true },
    });
    return { user };
  } catch (error) {
    if (error.code === "P2002") {
      return { error: "An account with this email already exists.", status: 409 };
    }
    throw error;
  }
}

export async function authenticateAccount(email, password) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || user.isBlocked) return null;

  const [saltHex, expectedHashHex] = user.passwordHash.split(":");
  const actualHash = Buffer.from(
    await scrypt(password, Buffer.from(saltHex, "hex"), PASSWORD_HASH_LENGTH)
  );
  const expectedHash = Buffer.from(expectedHashHex, "hex");

  if (
    actualHash.length !== expectedHash.length ||
    !timingSafeEqual(actualHash, expectedHash)
  ) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name || null };
}

export async function createSession(user) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await prisma.session.create({
    data: {
      id: randomUUID(),
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, isBlocked: true } },
    },
  });
  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { tokenHash: hashToken(token) } });
    return null;
  }

  if (session.user.isBlocked) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } });
    cookieStore.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    return null;
  }

  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}
