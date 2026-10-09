const { existsSync } = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");
const dotenv = require("dotenv");

const envLocalPath = path.resolve(process.cwd(), ".env.local");
dotenv.config(existsSync(envLocalPath) ? { path: envLocalPath } : undefined);

const { Permission, PrismaClient } = require("@prisma/client");
const scrypt = promisify(scryptCallback);
const databaseUrl = process.env.DATABASE_URL?.trim();
const prisma = new PrismaClient({
  ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
  log: ["error"],
});

function configuredEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${Buffer.from(hash).toString("hex")}`;
}

async function main() {
  const email = configuredEmail(process.env.MANAGER_EMAIL);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const configuredAdminEmail = configuredEmail(process.env.ADMIN_EMAIL);

  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!email) throw new Error("Set MANAGER_EMAIL to a valid email address.");
  if (adminEmails.includes(email) || configuredAdminEmail === email) {
    throw new Error("MANAGER_EMAIL must be different from the configured Admin email.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing?.role === "ADMIN") {
    throw new Error("The configured Manager email belongs to an Admin account; no changes were made.");
  }

  if (existing?.role === "MANAGER") {
    console.log(`Configured Manager account is already ready: ${email}.`);
    return;
  }

  const permissionEntries = Object.values(Permission).map((permission) => ({
    id: randomUUID(),
    permission,
    enabled: false,
  }));

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: { role: "MANAGER" },
      });
      await tx.managerAssignment.deleteMany({
        where: { OR: [{ userId: existing.id }, { managerId: existing.id }] },
      });
      await Promise.all(
        Object.values(Permission).map((permission) =>
          tx.userPermission.upsert({
            where: {
              userId_permission: { userId: existing.id, permission },
            },
            create: {
              id: randomUUID(),
              userId: existing.id,
              permission,
              enabled: false,
            },
            update: { enabled: false },
          }),
        ),
      );
    });
    console.log(`Existing configured account is now the Manager: ${email}. Its password was preserved; all Manager permissions are disabled.`);
    return;
  }

  const password = process.env.MANAGER_PASSWORD;
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("For first-time setup, set MANAGER_PASSWORD to a unique password of at least 12 characters.");
  }

  await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      passwordHash: await createPasswordHash(password),
      role: "MANAGER",
      userPermissions: { create: permissionEntries },
    },
    select: { id: true },
  });
  console.log(`Manager account created for ${email}. Sign in through /login; configure its permissions in Admin → Managers.`);
}

main()
  .catch((error) => {
    console.error(error.message || "Could not prepare the Manager account.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
