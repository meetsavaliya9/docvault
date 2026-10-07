import { config } from "dotenv";
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else {
  config();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed.js",
  },
});
