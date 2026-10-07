const { existsSync } = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");
const dotenv = require("dotenv");

const envLocalPath = path.resolve(process.cwd(), ".env.local");
dotenv.config(existsSync(envLocalPath) ? { path: envLocalPath } : undefined);

const { PrismaClient } = require("@prisma/client");
const scrypt = promisify(scryptCallback);
const databaseUrl = process.env.DATABASE_URL?.trim();
const prisma = new PrismaClient({
  ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
  log: ["error"],
});

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const allowedAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to a valid email address.");
  }
  if (!allowedAdmins.includes(email)) {
    throw new Error("ADMIN_EMAIL must also be included in ADMIN_EMAILS.");
  }
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD to a unique password of at least 12 characters.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw new Error("This user already exists. The bootstrap command will not change existing accounts or passwords.");
  }

  const salt = randomBytes(16);
  const passwordHash = await scrypt(password, salt, 64);

  await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      passwordHash: `${salt.toString("hex")}:${Buffer.from(passwordHash).toString("hex")}`,
    },
    select: { id: true },
  });

  console.log(`Admin account created for ${email}. Sign in through the existing admin login flow.`);
}

main()
  .catch((error) => {
    console.error(error.message || "Could not create the admin account.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
