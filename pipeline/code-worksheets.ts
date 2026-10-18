// Export per-code-file annotation worksheets to work/. The agent fills the slots;
// code-apply.ts merges them back into the code JSON with validation.
//
// Unlike page worksheets, the annotation slots are NOT pre-created: the author
// chooses which lines to annotate, so the worksheet prints the source with line
// numbers and the author appends `<<<NOTE line=N … NOTE>>>` blocks at the end.
//
// Usage:  npx tsx pipeline/code-worksheets.ts [filter]
//   filter is a substring of the code id, e.g. "logic" or "src/L5" or a full id.
//   With no filter, every annotatable file in code-index.json is exported.

import * as fs from "node:fs";
import * as path from "node:path";
import type { CodeFile } from "../src/types/content";
import { ROOT, CONTENT, readJson, codeWorksheetPath, codeJsonPath, isAnnotatable } from "./lib";

fs.mkdirSync(path.join(ROOT, "work"), { recursive: true });

const filter = process.argv[2];
const index: string[] = readJson<string[]>(path.join(CONTENT, "code-index.json")) ?? [];
const targets = index.filter((id) => isAnnotatable(id) && (!filter || id.includes(filter)));

if (targets.length === 0) {
  console.log(`no annotatable code files match ${JSON.stringify(filter ?? "(all)")}`);
  process.exit(0);
}

let written = 0;
for (const id of targets) {
  const cf = readJson<CodeFile>(codeJsonPath(id));
  if (!cf) { console.log(`SKIP ${id} — JSON missing`); continue; }

  const lines = cf.code.split("\n");
  const width = String(lines.length).length;
  const L: string[] = [];
  L.push(`# CODE ANNOTATION WORKSHEET — ${id}`);
  L.push(`# lang: ${cf.lang} | ${lines.length} lines | ${cf.githubUrl}`);
  L.push(`# Rules: work/GUIDE-CODE.md. The CODE IS NEVER TRANSLATED — verify.ts hashes it.`);
  L.push(`# Fill TITLE-HE and DESC-HE, then append <<<NOTE line=N …>>> blocks at the bottom.`);
  L.push("");
  L.push(`<<<TITLE-HE`);
  L.push(cf.titleHe ?? "");
  L.push(`TITLE-HE>>>`);
  L.push("");
  L.push(`<<<DESC-HE`);
  L.push(cf.descriptionHe ?? "");
  L.push(`DESC-HE>>>`);
  L.push("");
  L.push(`# ======================= SOURCE (read-only, for reference) =======================`);
  lines.forEach((ln, i) => L.push(`${String(i + 1).padStart(width)} | ${ln}`));
  L.push("");
  L.push(`# ============================== ANNOTATIONS =====================================`);
  L.push(`# One block per note. \`line\` is 1-based and the note renders ABOVE that line.`);
  L.push(`# Add as many as you need; order does not matter (they are sorted on apply).`);
  L.push(`# Aim for 4-10 structural notes on a 100-300 line file, not one per function.`);
  L.push(`# Delete the example below and write real blocks in its place.`);
  L.push("");

  const existing = [...(cf.annotations ?? [])].sort((a, b) => a.line - b.line);
  if (existing.length) {
    for (const a of existing) {
      L.push(`<<<NOTE line=${a.line}`);
      L.push(a.noteHe);
      L.push(`NOTE>>>`);
      L.push("");
    }
  } else {
    L.push(`<<<NOTE line=1`);
    L.push(``);
    L.push(`NOTE>>>`);
    L.push("");
  }

  fs.writeFileSync(codeWorksheetPath(id), L.join("\n"), "utf8");
  written++;
}

console.log(`code worksheets: ${written} written to work/ (filter: ${filter ?? "(all)"})`);
console.log(`next: fill the slots, then  npm run pipeline:code-apply -- <id-or-filter>`);
