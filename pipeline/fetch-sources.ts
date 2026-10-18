// Clone the course sources into sources/ (gitignored). Idempotent: an existing
// clone is left alone — delete the directory to re-fetch.
//
// sources/ is the only input the pipeline has. It is NOT vendored into this repo:
// the course material belongs to the course staff, so every clone fetches it
// straight from the upstream repositories.

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

const SOURCES: { dir: string; repo: string; branch?: string; what: string }[] = [
  { dir: "site", repo: "https://github.com/bguppl/interpreters", branch: "gh-pages", what: "course site (markdown pages)" },
  { dir: "interpreters", repo: "https://github.com/bguppl/interpreters", branch: "master", what: "interpreter source files" },
  { dir: "practice", repo: "https://github.com/bguppl/practice", what: "practice-session source files" },
];

for (const s of SOURCES) {
  const target = path.join(ROOT, "sources", s.dir);
  if (fs.existsSync(target)) {
    console.log(`sources/${s.dir} — already present, skipped`);
    continue;
  }
  console.log(`cloning ${s.repo}${s.branch ? ` (${s.branch})` : ""} → sources/${s.dir}  — ${s.what}`);
  execFileSync(
    "git",
    ["clone", "--depth", "1", ...(s.branch ? ["--branch", s.branch] : []), s.repo, target],
    { stdio: "inherit" },
  );
}

console.log("\nsources ready. Next: npm run pipeline:parse");
