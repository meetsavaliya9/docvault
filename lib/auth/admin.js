import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_SESSION_COOKIE = "docvault_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAdminEmail(email) {
  if (typeof email !== "string") return false;
  const configuredEmails = (process.env.ADMIN_EMAILS || "admin@gmail.com")
    .split(",")
    .map((val) => val.trim().toLowerCase())
    .filter(Boolean);

  return configuredEmails.includes(email.trim().toLowerCase());
}

export async function createAdminSession(user) {
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
  cookieStore.set(ADMIN_SESSION_COOKIE, token, ADMIN_COOKIE_OPTIONS);
}

export async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { tokenHash: hashToken(token) } });
    return null;
  }

  if (!isAdminEmail(session.user.email)) {
    return null;
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Administrator authorization required. Please sign in." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return { user, response: null };
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.set(ADMIN_SESSION_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
}
