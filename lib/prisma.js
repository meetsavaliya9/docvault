import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function getPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  return new PrismaClient({
    ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma || getPrismaClient();

globalForPrisma.prisma = prisma;

