/**
 * Copies Cesium's runtime assets into public/cesium so they are served at
 * /cesium/* identically in dev, in `nuxt build` output and on Vercel.
 *
 * CESIUM_BASE_URL in nuxt.config.ts must stay in sync with TARGET_DIR.
 */
import { cp, rm, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(rootDir, "node_modules", "cesium", "Build", "Cesium");
const targetDir = join(rootDir, "public", "cesium");

const COPIED_ENTRIES = ["Assets", "ThirdParty", "Widgets", "Workers"];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(sourceDir))) {
  console.error(
    `[cesium-assets] ${sourceDir} not found. Install dependencies before building.`,
  );
  process.exit(1);
}

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

for (const entry of COPIED_ENTRIES) {
  await cp(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
}

console.log(`[cesium-assets] copied ${COPIED_ENTRIES.join(", ")} to public/cesium`);
