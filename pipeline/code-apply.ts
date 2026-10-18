// Merge filled code worksheets from work/ back into public/content/code/**.json.
// Incremental and idempotent: a partly filled worksheet applies fine, so you can
// apply + commit after every file. NEVER touches `code` — verify.ts hashes it.
//
// Usage:  npx tsx pipeline/code-apply.ts [filter]
//   filter is a substring of the code id, e.g. "logic" or a full id.

import * as fs from "node:fs";
import * as path from "node:path";
import type { CodeFile } from "../src/types/content";
import { CONTENT, readJson, writeJson, codeWorksheetPath, codeJsonPath, isAnnotatable } from "./lib";

const filter = process.argv[2];
const index: string[] = readJson<string[]>(path.join(CONTENT, "code-index.json")) ?? [];
const targets = index.filter((id) => isAnnotatable(id) && (!filter || id.includes(filter)));

const readSingle = (ws: string, kind: string): string | undefined => {
  const m = ws.match(new RegExp(`<<<${kind}\\n([\\s\\S]*?)\\n?${kind}>>>`));
  const v = m?.[1]?.trim();
  return v ? v : undefined;
};

let applied = 0, skipped = 0, totalNotes = 0;
const problems: string[] = [];

for (const id of targets) {
  const wsPath = codeWorksheetPath(id);
  if (!fs.existsSync(wsPath)) { skipped++; continue; }
  const cf = readJson<CodeFile>(codeJsonPath(id));
  if (!cf) { problems.push(`${id}: code JSON missing`); continue; }

  const ws = fs.readFileSync(wsPath, "utf8");
  const lineCount = cf.code.split("\n").length;

  const titleHe = readSingle(ws, "TITLE-HE");
  const descriptionHe = readSingle(ws, "DESC-HE");

  const notes: { line: number; noteHe: string }[] = [];
  for (const m of ws.matchAll(/<<<NOTE line=(\d+)\n([\s\S]*?)\n?NOTE>>>/g)) {
    const line = Number(m[1]);
    const noteHe = m[2].trim();
    if (!noteHe) continue;                       // unfilled slot — ignore, not an error
    if (line < 1 || line > lineCount) {
      problems.push(`${id}: note line=${line} out of range (file has ${lineCount} lines)`);
      continue;
    }
    if (noteHe.includes("\\n")) problems.push(`${id}: note line=${line} contains a literal \\n (notes are raw markdown)`);
    notes.push({ line, noteHe });
  }
  notes.sort((a, b) => a.line - b.line);

  if (!titleHe && !descriptionHe && notes.length === 0) { skipped++; continue; }

  const next: CodeFile = {
    ...cf,
    titleHe: titleHe ?? cf.titleHe,
    descriptionHe: descriptionHe ?? cf.descriptionHe,
    annotations: notes.length ? notes : cf.annotations,
  };
  writeJson(codeJsonPath(id), next);
  applied++;
  totalNotes += notes.length;

  const missing: string[] = [];
  if (!next.titleHe) missing.push("titleHe");
  if (!next.descriptionHe) missing.push("descriptionHe");
  if (!next.annotations?.length) missing.push("annotations");
  console.log(
    `${missing.length ? "PARTIAL" : "OK     "} ${id} — ${notes.length} note(s)` +
    (missing.length ? `  [missing: ${missing.join(", ")}]` : ""),
  );
}

console.log(`\ncode-apply: ${applied} file(s) updated, ${totalNotes} annotation(s), ${skipped} with no filled worksheet`);
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
