// Every page's module script and every local import it pulls in must exist.
// No build step means a typo in an import path only shows as a blank screen,
// so CI catches it here instead.
//
//   node scripts/check-pages.mjs

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const seen = new Set();

function walk(file, from) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!existsSync(file)) return problems.push(`${from} imports a missing file: ${file.slice(root.length + 1)}`);
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:import|export)\s[^"']*?from\s+["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
    walk(resolve(dirname(file), m[1] || m[2]), file.slice(root.length + 1));
  }
}

for (const page of readdirSync(root).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(root, page), "utf8");
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) walk(join(root, m[1]), page);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`${seen.size} modules reachable from the pages, all present.`);
