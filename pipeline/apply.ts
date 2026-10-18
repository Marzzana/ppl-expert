// Merge a filled worksheet back into its page JSON.
// Usage: tsx pipeline/apply.ts <pageId>   (e.g. cm/1.1TypescriptDatatypes)
// Validates block ids, keeps code verbatim, updates glossary, sets `translated`
// when the page is complete. Safe to run repeatedly / on partial worksheets.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Page, Exercise } from "../src/types/content";
import { ROOT, CONTENT, readJson, writeJson, pageJsonPath } from "./lib";

const pageId = process.argv[2];
if (!pageId) {
  console.error("usage: tsx pipeline/apply.ts <pageId>");
  process.exit(1);
}
const wsPath = path.join(ROOT, "work", pageId.replace(/\//g, "__") + ".md");
const page = readJson<Page>(pageJsonPath(pageId));
if (!page) {
  console.error(`page JSON not found for ${pageId}`);
  process.exit(1);
}
if (!fs.existsSync(wsPath)) {
  console.error(`worksheet not found: ${wsPath}`);
  process.exit(1);
}
const ws = fs.readFileSync(wsPath, "utf8").replace(/\r\n/g, "\n");

const problems: string[] = [];
const slot = (kind: string, id: string) => {
  const re = new RegExp(`<<<${kind} ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)\\n?${kind}>>>`);
  const m = ws.match(re);
  return m ? m[1].trim() : undefined;
};
const simpleSlot = (kind: string) => {
  const m = ws.match(new RegExp(`<<<${kind}\\n([\\s\\S]*?)\\n?${kind}>>>`));
  return m ? m[1].trim() : undefined;
};

// title
const title = simpleSlot("TITLE-HE");
if (title) page.titleHe = title;

// sections + blocks
let filled = 0;
for (const s of page.sections) {
  if (s.raw.trim() !== "") {
    const h = slot("HEADING-HE", s.id);
    if (h) {
      s.headingHe = h;
      filled++;
    }
  }
  for (const b of s.blocks) {
    if (b.type === "code") {
      const note = slot("NOTE", b.id);
      if (note) {
        b.noteHe = note;
        filled++;
      }
    } else if (b.type !== "hr" && b.type !== "image") {
      const he = slot("HE", b.id);
      if (he) {
        if (he.includes("```") && !b.en.includes("```")) problems.push(`${b.id}: translation adds a code fence not present in source`);
        b.he = he;
        filled++;
      }
    }
  }
}

// exercises
const exRaw = simpleSlot("EXERCISES");
if (exRaw) {
  try {
    const clean = exRaw.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
    const exs = JSON.parse(clean) as Exercise[];
    if (!Array.isArray(exs)) throw new Error("not an array");
    for (const e of exs) {
      if (!e.id || !e.type || !e.questionHe) problems.push(`exercise missing id/type/questionHe: ${JSON.stringify(e).slice(0, 80)}`);
      if (e.type === "mcq" && (!e.options || typeof e.correct !== "number")) problems.push(`mcq ${e.id} missing options/correct`);
      if ((e.type === "open" || e.type === "code-reading") && !e.answerHe) problems.push(`${e.type} ${e.id} missing answerHe`);
    }
    const ids = new Set(exs.map((e) => e.id));
    if (ids.size !== exs.length) problems.push("duplicate exercise ids");
    page.exercises = exs;
  } catch (err) {
    problems.push(`EXERCISES JSON invalid: ${err}`);
  }
}

// glossary — written to a per-page sidecar (merged later by pipeline/merge-glossary.ts)
// so parallel apply runs never clobber the shared glossary.json.
const glRaw = simpleSlot("GLOSSARY");
if (glRaw) {
  try {
    const clean = glRaw.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
    const gl = JSON.parse(clean) as Record<string, string>;
    writeJson(path.join(ROOT, "work", "glossary", pageId.replace(/\//g, "__") + ".json"), gl);
  } catch (err) {
    problems.push(`GLOSSARY JSON invalid: ${err}`);
  }
}

// role overrides (practice pages): [{"id": "ps/ps3:5" | "ps/ps3:5:2", "role": "question"|"solution"|null, "questionId": 2}]
const rolesRaw = simpleSlot("ROLES");
if (rolesRaw) {
  try {
    const clean = rolesRaw.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
    const overrides = JSON.parse(clean) as { id: string; role: "question" | "solution" | null; questionId?: number }[];
    for (const o of overrides) {
      const parts = o.id.split(":");
      const section = page.sections.find((s) => s.id === (parts.length === 2 ? o.id : parts.slice(0, 2).join(":")));
      if (!section) {
        problems.push(`ROLES: unknown id ${o.id}`);
        continue;
      }
      const target = parts.length === 2 ? section : section.blocks.find((b) => b.id === o.id);
      if (!target) {
        problems.push(`ROLES: unknown block ${o.id}`);
        continue;
      }
      target.role = o.role ?? undefined;
      target.questionId = o.role === null ? undefined : (o.questionId ?? target.questionId);
    }
  } catch (err) {
    problems.push(`ROLES JSON invalid: ${err}`);
  }
}

// completeness → translated flag
const translatable = page.sections.flatMap((s) => s.blocks).filter((b) => b.type !== "code" && b.type !== "hr" && b.type !== "image");
const missingBlocks = translatable.filter((b) => b.he === undefined).map((b) => b.id);
const missingHeadings = page.sections.filter((s) => s.raw.trim() !== "" && s.headingHe === undefined).map((s) => s.id);
const missingNotes = page.sections.flatMap((s) => s.blocks).filter((b) => b.type === "code" && b.noteHe === undefined).map((b) => b.id);
const needsExercises = page.kind === "lecture" && !(page.exercises && page.exercises.length >= 3);

const complete = missingBlocks.length === 0 && missingHeadings.length === 0 && !!page.titleHe && !needsExercises;
page.translated = complete;
writeJson(pageJsonPath(pageId), page);

console.log(`applied ${filled} filled slots to ${pageId}`);
console.log(`status: ${complete ? "COMPLETE — page marked translated" : "incomplete"}`);
if (!complete) {
  if (!page.titleHe) console.log("  missing: titleHe");
  if (missingBlocks.length) console.log(`  missing ${missingBlocks.length} block translations: ${missingBlocks.slice(0, 8).join(", ")}${missingBlocks.length > 8 ? " …" : ""}`);
  if (missingHeadings.length) console.log(`  missing ${missingHeadings.length} headings: ${missingHeadings.slice(0, 8).join(", ")}`);
  if (needsExercises) console.log("  missing: exercises (lecture pages need >= 3)");
}
if (missingNotes.length) console.log(`  note: ${missingNotes.length} code blocks without noteHe (allowed, but aim for full coverage): ${missingNotes.slice(0, 6).join(", ")}${missingNotes.length > 6 ? " …" : ""}`);
if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems) console.log("  - " + p);
  process.exitCode = 1;
}
