// Checks js/common/ is exactly a released web-common copy: every file in the
// manifest present and unchanged, and nothing extra. Run by CI before deploy.
//
//   node scripts/verify-common.mjs
//
// A hand edit here would silently fork this site from the others, so it fails
// the deploy instead. Change ibull-functions/web-common and re-vendor.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "js", "common");
const manifestPath = join(dir, "MANIFEST.json");
if (!existsSync(manifestPath)) { console.error("js/common/MANIFEST.json is missing."); process.exit(1); }
const m = JSON.parse(readFileSync(manifestPath, "utf8"));

const sha = (s) => createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");
const problems = [];
for (const [f, want] of Object.entries(m.files)) {
  const p = join(dir, f);
  if (!existsSync(p)) problems.push(`${f} is missing`);
  else if (sha(readFileSync(p, "utf8")) !== want) problems.push(`${f} was edited by hand`);
}
for (const f of readdirSync(dir)) {
  if (f !== "MANIFEST.json" && !m.files[f]) problems.push(`${f} is not part of web-common v${m.version}`);
}
if (problems.length) {
  console.error(`js/common does not match web-common v${m.version}:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`js/common = web-common v${m.version} (${m.commit}), ${Object.keys(m.files).length} files verified.`);
