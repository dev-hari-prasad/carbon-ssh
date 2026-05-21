/**
 * Writes SHA256SUMS.txt for all files in dist-electron-out (excluding the sums file itself).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist-electron-out");
const lines = [];
for (const name of readdirSync(dir)) {
  if (name === "SHA256SUMS.txt") continue;
  const buf = readFileSync(join(dir, name));
  const hash = createHash("sha256").update(buf).digest("hex");
  lines.push(`${hash}  ${name}`);
}
writeFileSync(join(dir, "SHA256SUMS.txt"), `${lines.join("\n")}\n`);
