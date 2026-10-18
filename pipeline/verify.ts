// Completeness verifier: proves public/content/ faithfully contains EVERYTHING
// from sources/. Structural checks are hard failures; translation-progress
// checks are informational until a page is marked translated.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Page, CodeFile, Toc, LearningPath } from "../src/types/content";
import {
  ROOT, SITE, REPOS, CONTENT,
  listSourcePages, parseSource, collectCodeLinks, expandCodeLink, isNoiseCodeFile,
  readJson, pageJsonPath, hashOf,
} from "./lib";

const fail: string[] = [];
const info: string[] = [];
const rows: string[] = [];

// ------------------------------------------------------------------ pages ---

const pages = listSourcePages();
const sourceTexts: string[] = [];
let translatedPages = 0;

for (const meta of pages) {
  const src = fs.readFileSync(path.join(SITE, meta.sourcePath), "utf8");
  sourceTexts.push(src);
  const expected = parseSource(meta, src);
  const page = readJson<Page>(pageJsonPath(meta.id));
  const label = meta.id;

  if (!page) {
    fail.push(`${label}: JSON missing`);
    continue;
  }
  if (!expected.coverageOk) fail.push(`${label}: lexer did not cover source file`);

  const eSecs = expected.sections;
  const jSecs = page.sections;
  let secErr = 0, blockErr = 0, codeErr = 0;

  if (eSecs.length !== jSecs.length) {
    fail.push(`${label}: section count ${jSecs.length} != expected ${eSecs.length}`);
  } else {
    for (let si = 0; si < eSecs.length; si++) {
      const es = eSecs[si], js = jSecs[si];
      if (es.raw.trim() !== js.raw.trim() || es.headingEn !== js.headingEn) secErr++;
      if (es.blocks.length !== js.blocks.length) {
        blockErr++;
        fail.push(`${label} section ${si}: block count ${js.blocks.length} != expected ${es.blocks.length}`);
        continue;
      }
      for (let bi = 0; bi < es.blocks.length; bi++) {
        const eb = es.blocks[bi], jb = js.blocks[bi];
        if (eb.en.trim() !== jb.en.trim() || jb.hash !== hashOf(eb.en.trim())) {
          blockErr++;
          fail.push(`${label} block ${si}:${bi}: source text mismatch (stale or edited 'en')`);
        }
        // code must be byte-identical (trimmed raw includes the fence)
        if (eb.type === "code" && jb.en.trim() !== eb.en.trim()) codeErr++;
        if (jb.type === "code" && jb.he !== undefined) fail.push(`${label} block ${si}:${bi}: code block has 'he' (code must stay verbatim)`);
      }
    }
    if (secErr) fail.push(`${label}: ${secErr} section heading mismatches`);
  }

  // translation progress
  const translatable = jSecs.flatMap((s) => s.blocks).filter((b) => b.type !== "code" && b.type !== "hr" && b.type !== "image");
  const done = translatable.filter((b) => b.he !== undefined).length;
  const headings = jSecs.filter((s) => s.raw.trim() !== "");
  const headingsDone = jSecs.filter((s) => s.raw.trim() !== "" && s.headingHe !== undefined).length;

  if (page.translated) {
    translatedPages++;
    if (done < translatable.length) fail.push(`${label}: marked translated but ${translatable.length - done} blocks untranslated`);
    if (headingsDone < headings.length) fail.push(`${label}: marked translated but ${headings.length - headingsDone} headings untranslated`);
    if (!page.titleHe) fail.push(`${label}: marked translated but no titleHe`);
    if (meta.kind === "lecture" && !(page.exercises && page.exercises.length > 0))
      fail.push(`${label}: lecture marked translated but has no exercises`);
    if (meta.kind === "practice") {
      const qids = new Set(jSecs.filter((s) => s.role === "question").map((s) => s.questionId));
      const solved = new Set([
        ...jSecs.filter((s) => s.role === "solution").map((s) => s.questionId),
        ...jSecs.flatMap((s) => s.blocks).filter((b) => b.role === "solution").map((b) => b.questionId),
      ]);
      for (const q of qids) if (!solved.has(q) && !(page.exercises ?? []).some((e) => e.id === `q${q}`))
        info.push(`${label}: question ${q} has no solution blocks or authored answer (exercise id q${q})`);
    }
  }

  const status = secErr + blockErr + codeErr === 0 ? "OK" : "FAIL";
  rows.push(`| ${label} | ${jSecs.length} | ${translatable.length} | ${done}/${translatable.length} | ${page.translated ? "yes" : "—"} | ${status} |`);
}

// --------------------------------------------------------------- toc/path ---

const toc = readJson<Toc>(path.join(CONTENT, "toc.json"));
const lp = readJson<LearningPath>(path.join(CONTENT, "path.json"));
if (!toc) fail.push("toc.json missing");
if (!lp) fail.push("path.json missing");

const known = new Set(pages.map((p) => p.id));
if (toc) {
  for (const ch of toc.classMaterial) for (const e of ch.entries) if (!known.has(e.pageId)) fail.push(`toc: unknown page ${e.pageId}`);
  for (const e of toc.practiceSessions) if (!known.has(e.pageId)) fail.push(`toc: unknown page ${e.pageId}`);
  // every lecture/practice source page must be reachable from the toc
  const inToc = new Set([
    ...toc.classMaterial.flatMap((c) => c.entries.map((e) => e.pageId)),
    ...toc.practiceSessions.map((e) => e.pageId),
  ]);
  for (const p of pages) {
    if (p.kind === "links") continue;
    if (!inToc.has(p.id)) info.push(`toc: page ${p.id} not linked from original index pages (kept in platform anyway)`);
  }
}
if (lp) {
  const counts = new Map<string, number>();
  for (const it of lp.items) counts.set(it.pageId, (counts.get(it.pageId) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (!known.has(id)) fail.push(`path: unknown page ${id}`);
    if (n > 1) fail.push(`path: ${id} appears ${n} times`);
  }
  for (const p of pages) {
    if (p.kind === "links") continue;
    if (!counts.has(p.id)) fail.push(`path: page ${p.id} missing from learning path`);
  }
}

// ------------------------------------------------------------- code files ---

const codeIndex = readJson<string[]>(path.join(CONTENT, "code-index.json")) ?? [];
const codeSet = new Set(codeIndex);
const links = collectCodeLinks(sourceTexts.concat(
  fs.readFileSync(path.join(SITE, "class_material.md"), "utf8"),
  fs.readFileSync(path.join(SITE, "practice_sessions.md"), "utf8"),
));
for (const link of links) {
  const { files, missing } = expandCodeLink(link);
  if (missing) { fail.push(`code: link target not in local clone: ${link.url}`); continue; }
  for (const rel of files) {
    if (isNoiseCodeFile(rel)) continue; // binaries / lockfiles / build config — see lib.ts
    const id = `${link.repo}/${rel}`;
    if (!codeSet.has(id)) { fail.push(`code: ${id} linked but not in content/code`); continue; }
    const cf = readJson<CodeFile>(path.join(CONTENT, "code", ...id.split("/")) + ".json");
    if (!cf) { fail.push(`code: ${id} in index but JSON missing`); continue; }
    const local = fs.readFileSync(path.join(REPOS[link.repo], rel), "utf8").replace(/\r\n/g, "\n");
    if (cf.code !== local) fail.push(`code: ${id} content differs from source repo`);
  }
}

// ----------------------------------------------------------------- images ---

const IMG_RE = /!\[[^\]]*\]\(([^)\s]+)\)/g;
for (const meta of pages) {
  const src = fs.readFileSync(path.join(SITE, meta.sourcePath), "utf8");
  for (const m of src.matchAll(IMG_RE)) {
    const ref = m[1];
    if (/^https?:/.test(ref)) continue;
    const group = meta.sourcePath.startsWith("class_material") ? "class_material" : "practice_sessions";
    const rel = decodeURIComponent(ref).replace(/^\.\//, "").replace(/^\.\.\//, "");
    const p = path.join(ROOT, "public", "resources", group, rel.replace(/^resources\//, ""));
    if (!fs.existsSync(p)) fail.push(`image: ${meta.id} references ${ref} → not found at ${path.relative(ROOT, p)}`);
  }
}

// ----------------------------------------------------------------- report ---

const report = [
  `# Verification Report`,
  ``,
  `- Pages: ${pages.length} (${translatedPages} translated)`,
  `- Code files: ${codeIndex.length}`,
  `- Hard failures: ${fail.length}`,
  `- Info: ${info.length}`,
  ``,
  `| page | sections | translatable blocks | translated | marked | structure |`,
  `|---|---|---|---|---|---|`,
  ...rows,
  ``,
  fail.length ? `## FAILURES\n${fail.map((f) => "- " + f).join("\n")}` : `## All structural checks PASSED`,
  info.length ? `\n## Info\n${info.map((f) => "- " + f).join("\n")}` : ``,
].join("\n");

fs.writeFileSync(path.join(ROOT, "verification-report.md"), report, "utf8");
console.log(`pages ${pages.length}, translated ${translatedPages}, code files ${codeIndex.length}`);
if (fail.length) {
  console.log(`\n${fail.length} FAILURES:`);
  for (const f of fail.slice(0, 30)) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log("verify: ALL STRUCTURAL CHECKS PASSED");
}
if (info.length) console.log(`(${info.length} info notes — see verification-report.md)`);
