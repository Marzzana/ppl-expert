// Export per-page translation worksheets to work/. Agents fill the slots;
// apply.ts merges them back into the page JSON with validation.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Page } from "../src/types/content";
import { ROOT, listSourcePages, readJson, pageJsonPath } from "./lib";

const WORK = path.join(ROOT, "work");
fs.mkdirSync(WORK, { recursive: true });

export const worksheetPath = (id: string) => path.join(WORK, id.replace(/\//g, "__") + ".md");

const only = process.argv[2]; // optional pageId filter prefix

for (const meta of listSourcePages()) {
  if (only && !meta.id.startsWith(only)) continue;
  const page = readJson<Page>(pageJsonPath(meta.id))!;
  const L: string[] = [];
  L.push(`# TRANSLATION WORKSHEET — ${page.id} (${page.kind})`);
  L.push(`# Source: sources/site/${page.sourcePath}`);
  L.push(`# Fill every <<<…>>> slot. Instructions: work/GUIDE.md`);
  L.push("");
  L.push(`@TITLE-EN: ${page.titleEn}`);
  L.push(`<<<TITLE-HE`);
  L.push(page.titleHe ?? "");
  L.push(`TITLE-HE>>>`);

  for (const s of page.sections) {
    L.push("");
    L.push(`===== SECTION ${s.id} depth=${s.depth}${s.role ? ` role=${s.role} q=${s.questionId}` : ""} =====`);
    if (s.raw.trim() !== "") {
      L.push(`@HEADING-EN: ${s.headingEn}`);
      L.push(`<<<HEADING-HE ${s.id}`);
      L.push(s.headingHe ?? "");
      L.push(`HEADING-HE>>>`);
    }
    for (const b of s.blocks) {
      L.push("");
      if (b.type === "code") {
        L.push(`--- BLOCK ${b.id} [code${b.lang ? " " + b.lang : ""}] (do NOT translate code — write a Hebrew explanation note) ---`);
        L.push(b.en.trim());
        L.push(`<<<NOTE ${b.id}`);
        L.push(b.noteHe ?? "");
        L.push(`NOTE>>>`);
      } else if (b.type === "hr" || b.type === "image") {
        L.push(`--- BLOCK ${b.id} [${b.type}] (nothing to fill) ---`);
        L.push(b.en.trim());
      } else {
        L.push(`--- BLOCK ${b.id} [${b.type}]${b.role ? ` role=${b.role} q=${b.questionId}` : ""} ---`);
        L.push(b.en.trim());
        L.push(`<<<HE ${b.id}`);
        L.push(b.he ?? "");
        L.push(`HE>>>`);
      }
    }
  }

  L.push("");
  L.push(`===== EXERCISES (${page.kind === "lecture" ? "REQUIRED: 4-8 items" : "practice pages: only model answers for unsolved questions, ids q1,q2,…"}) =====`);
  L.push(`<<<EXERCISES`);
  L.push(page.exercises ? JSON.stringify(page.exercises, null, 1) : "");
  L.push(`EXERCISES>>>`);
  if (meta.kind === "practice") {
    L.push("");
    L.push(`===== ROLES (fix wrong question/solution tags; JSON array or leave empty) =====`);
    L.push(`# Sections above show their detected role= / q=. If a section/block is wrongly tagged,`);
    L.push(`# override: [{"id": "${meta.id}:5", "role": "solution", "questionId": 2}] — role null clears.`);
    L.push(`<<<ROLES`);
    L.push(``);
    L.push(`ROLES>>>`);
  }
  L.push("");
  L.push(`===== GLOSSARY (new terms you translated: {"English term": "עברית"}) =====`);
  L.push(`<<<GLOSSARY`);
  L.push(``);
  L.push(`GLOSSARY>>>`);
  L.push("");

  fs.writeFileSync(worksheetPath(meta.id), L.join("\n"), "utf8");
  console.log("worksheet:", worksheetPath(meta.id));
}
