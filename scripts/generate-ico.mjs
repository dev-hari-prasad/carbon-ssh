/**
 * generate-ico.mjs
 *
 * Converts  public/logo/Carbon logo light.png  →  build/icon.ico  +  build/icon.png
 *
 * Produces a multi-resolution Windows .ico containing 256, 128, 64, 48, 32, and 16 px layers.
 * Requires:  pnpm add -D sharp png-to-ico   (one-time dev dependency)
 *
 * Usage:  node scripts/generate-ico.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SOURCE_PNG = join(ROOT, "public", "logo", "Carbon logo light.png");
const BUILD_DIR = join(ROOT, "build");
const OUT_ICO = join(BUILD_DIR, "icon.ico");
const OUT_PNG = join(BUILD_DIR, "icon.png");

const SIZES = [256, 128, 64, 48, 32, 16];

async function main() {
  console.log("[generate-ico] Creating build/ directory …");
  await mkdir(BUILD_DIR, { recursive: true });

  // 1. Copy source PNG as build/icon.png (for electron-builder)
  console.log("[generate-ico] Copying source PNG → build/icon.png");
  await copyFile(SOURCE_PNG, OUT_PNG);

  // 2. Generate resized PNGs in memory for each .ico layer
  console.log(`[generate-ico] Generating ${SIZES.length} icon layers …`);
  const pngBuffers = await Promise.all(
    SIZES.map((size) =>
      sharp(SOURCE_PNG)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  // 3. Bundle into .ico
  console.log("[generate-ico] Bundling into .ico …");
  const icoBuffer = await pngToIco(pngBuffers);

  // 4. Write the .ico file
  const { writeFile } = await import("node:fs/promises");
  await writeFile(OUT_ICO, icoBuffer);

  console.log(`[generate-ico] ✔ build/icon.ico  (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`[generate-ico] ✔ build/icon.png  (copy of source)`);
}

main().catch((err) => {
  console.error("[generate-ico] ✘ Failed:", err.message);
  process.exit(1);
});
