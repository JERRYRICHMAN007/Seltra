/**
 * Push Seltra API env vars from local .env to Vercel (Production + Preview).
 *
 * Usage (from seltra-ops-platform):
 *   npx vercel link          # once, pick project "seltra-seven"
 *   node scripts/set-vercel-seltra-env.mjs
 *   npx vercel --prod        # redeploy
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

function parseEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return out;
}

if (!existsSync(envPath)) {
  console.error("Missing .env — cannot read SELTRA_* values.");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const pairs = [
  ["SELTRA_API_BASE_URL", env.SELTRA_API_BASE_URL || "https://seltra-merchant-backend.onrender.com"],
  ["SELTRA_INTERNAL_API_KEY", env.SELTRA_INTERNAL_API_KEY || env.OPS_INTERNAL_API_KEY],
  ["OPS_INTERNAL_API_KEY", env.OPS_INTERNAL_API_KEY || env.SELTRA_INTERNAL_API_KEY],
];

for (const [key, value] of pairs) {
  if (!value) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

const environments = ["production", "preview"];

for (const [key, value] of pairs) {
  for (const target of environments) {
    console.log(`Setting ${key} → ${target}…`);
    const result = spawnSync("npx", ["vercel", "env", "add", key, target, "--force"], {
      cwd: root,
      input: `${value}\n`,
      encoding: "utf8",
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (result.status !== 0) {
      console.error(`Failed to set ${key} for ${target} (exit ${result.status}).`);
      console.error("Run: npx vercel link   then retry this script.");
      process.exit(result.status || 1);
    }
  }
}

console.log("\nDone. Redeploy Production for changes to apply:");
console.log("  npx vercel --prod");
