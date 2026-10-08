const { existsSync } = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envLocalPath = path.resolve(__dirname, "../.env.local");
if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const { PrismaClient } = require("@prisma/client");
const databaseUrl = process.env.DATABASE_URL?.trim();
const prisma = new PrismaClient({
  ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
});

const initialPlans = [
  {
    id: "FREE",
    slug: "FREE",
    name: "Free",
    price: 0,
    currency: "INR",
    billingPeriod: "monthly",
    description: "A simple start for your personal document vault.",
    features: ["Basic document search", "Upload documents", "Delete documents"],
    documentLimit: 10,
    storageLimitBytes: BigInt(100 * 1024 ** 2),
    isActive: true,
    isRecommended: false,
    displayOrder: 0,
  },
  {
    id: "PLUS",
    slug: "PLUS",
    name: "Plus",
    price: 19900,
    currency: "INR",
    billingPeriod: "monthly",
    description: "More room and powerful tools for growing document libraries.",
    features: ["Advanced search", "Document preview", "Priority support"],
    documentLimit: 100,
    storageLimitBytes: BigInt(5 * 1024 ** 3),
    isActive: true,
    isRecommended: true,
    displayOrder: 1,
  },
  {
    id: "PRO",
    slug: "PRO",
    name: "Pro",
    price: 49900,
    currency: "INR",
    billingPeriod: "monthly",
    description: "Complete document management for power users.",
    features: ["Advanced document management", "Premium features", "Priority support"],
    documentLimit: null,
    storageLimitBytes: BigInt(25 * 1024 ** 3),
    isActive: true,
    isRecommended: false,
    displayOrder: 2,
  },
];

async function main() {
  for (const plan of initialPlans) {
    const planData = { ...plan, features: JSON.stringify(plan.features) };
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      create: planData,
      update: {},
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to seed subscription plans:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
