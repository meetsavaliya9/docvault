import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const nextCli = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../node_modules/next/dist/bin/next"
);

const result = spawnSync(process.execPath, [nextCli, ...process.argv.slice(2)], {
  env: { ...process.env, NODE_USE_SYSTEM_CA: "1" },
  stdio: "inherit",
});

if (result.error) {
  console.error("Could not start the Next.js CLI.", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
