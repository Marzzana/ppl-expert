// Build public/content/ from sources/. Idempotent: re-running preserves any
// translations (he/noteHe/headingHe/titleHe/exercises/annotations) already in
// the JSON by matching blocks on their source hash.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Page, Section, CodeFile, Toc, TocChapter, LearningPath } from "../src/types/content";
import {
  SITE, REPOS, CONTENT, PATH_ORDER, LANG_BY_EXT,
  listSourcePages, parseSource, collectCodeLinks, expandCodeLink, isNoiseCodeFile,
  readJson, writeJson, pageJsonPath,
} from "./lib";
import { Lexer } from "marked";

const problems: string[] = [];

// ------------------------------------------------------------------ pages ---

const pages = listSourcePages();
const sourceTexts: string[] = [];

for (const meta of pages) {
  const src = fs.readFileSync(path.join(SITE, meta.sourcePath), "utf8");
  sourceTexts.push(src);
  const { titleEn, sections, coverageOk } = parseSource(meta, src);
  if (!coverageOk) problems.push(`lexer coverage FAILED for ${meta.sourcePath}`);

  const old = readJson<Page>(pageJsonPath(meta.id));
  const page: Page = {
    id: meta.id,
    kind: meta.kind,
    sourcePath: meta.sourcePath,
    titleEn,
    titleHe: old?.titleHe,
    translated: old?.translated ?? false,
    sections,
    exercises: old?.exercises,
  };

  if (old) {
    // hash → queue of old blocks (order-preserving for duplicate content)
    const oldBlocks = new Map<string, (typeof old.sections)[0]["blocks"]>();
    const byHash = new Map<string, any[]>();
    for (const s of old.sections) for (const b of s.blocks) {
      const q = byHash.get(b.hash) ?? [];
      q.push(b);
      byHash.set(b.hash, q);
    }
    for (const s of page.sections) for (const b of s.blocks) {
      const q = byHash.get(b.hash);
      const ob = q?.shift();
      if (ob) {
        if (ob.he !== undefined) b.he = ob.he;
        if (ob.noteHe !== undefined) b.noteHe = ob.noteHe;
        if ("role" in ob) { b.role = ob.role ?? undefined; b.questionId = ob.questionId ?? undefined; }
      }
    }
    // sections matched by heading raw, in order
    const oldSecs = [...old.sections];
    for (const s of page.sections) {
      const i = oldSecs.findIndex((os) => os.raw.trim() === s.raw.trim());
      if (i >= 0) {
        const os = oldSecs.splice(i, 1)[0];
        if (os.headingHe !== undefined) s.headingHe = os.headingHe;
        if ("role" in os && os.role !== s.role) { s.role = os.role ?? undefined; s.questionId = os.questionId ?? undefined; }
      }
    }
  }

  writeJson(pageJsonPath(meta.id), page);
}
console.log(`pages: ${pages.length} written`);

// -------------------------------------------------------------- resources ---

for (const [from, to] of [
  [path.join(SITE, "class_material", "resources"), path.join(CONTENT, "..", "resources", "class_material")],
  [path.join(SITE, "practice_sessions", "resources"), path.join(CONTENT, "..", "resources", "practice_sessions")],
] as const) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}
console.log("resources copied");

// -------------------------------------------------------------------- toc ---

function buildGroups(file: string): { title: string; links: { text: string; url: string }[] }[] {
  const text = fs.readFileSync(path.join(SITE, file), "utf8").replace(/\r\n/g, "\n");
  const tokens = new Lexer().lex(text);
  const groups: { title: string; links: { text: string; url: string }[] }[] = [];
  let cur = { title: "", links: [] as { text: string; url: string }[] };
  const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  for (const t of tokens) {
    if (t.type === "heading") {
      if (cur.links.length) groups.push(cur);
      cur = { title: t.text.trim(), links: [] };
    } else if ("raw" in t) {
      for (const m of (t.raw as string).matchAll(LINK_RE)) cur.links.push({ text: m[1], url: m[2] });
    }
  }
  if (cur.links.length) groups.push(cur);
  return groups;
}

const htmlToPageId = (url: string): string | undefined => {
  let m = url.match(/(?:^|\/)class_material\/([^/]+)\.(?:html|md)$/);
  if (m) return `cm/${m[1]}`;
  m = url.match(/practice_sessions\/reading_material\/([^/]+)\.(?:html|md)$/);
  if (m) return `reading/${m[1]}`;
  m = url.match(/(?:^|\/)practice_sessions\/([^/]+)\.(?:html|md)$/);
  if (m) return `ps/${m[1]}`;
  return undefined;
};

const pageTitle = new Map(pages.map((p) => {
  const j = readJson<Page>(pageJsonPath(p.id))!;
  return [p.id, j.titleEn];
}));

const cmGroups = buildGroups("class_material.md");
const psGroups = buildGroups("practice_sessions.md");

const toc: Toc = { classMaterial: [], practiceSessions: [], codeGroups: [] };
for (const g of cmGroups) {
  const entries = g.links.map((l) => ({ l, pid: htmlToPageId(l.url) })).filter((x) => x.pid);
  const code = g.links.filter((l) => l.url.includes("github.com/bguppl"));
  if (entries.length) {
    toc.classMaterial.push({
      titleEn: g.title,
      entries: entries.map((x) => ({ pageId: x.pid!, titleEn: x.l.text })),
    } as TocChapter);
  }
  if (code.length) toc.codeGroups.push({ titleEn: g.title, files: code.map((l) => l.url) });
}
for (const g of psGroups) {
  for (const l of g.links) {
    const pid = htmlToPageId(l.url);
    if (pid) toc.practiceSessions.push({ pageId: pid, titleEn: l.text });
  }
}
// Every linked page must exist
for (const ch of toc.classMaterial) for (const e of ch.entries)
  if (!pageTitle.has(e.pageId)) problems.push(`toc: missing page ${e.pageId}`);
for (const e of toc.practiceSessions)
  if (!pageTitle.has(e.pageId)) problems.push(`toc: missing page ${e.pageId}`);

writeJson(path.join(CONTENT, "toc.json"), toc);
console.log(`toc: ${toc.classMaterial.length} class groups, ${toc.practiceSessions.length} ps entries, ${toc.codeGroups.length} code groups`);

// ------------------------------------------------------------------- path ---

const known = new Set(pages.map((p) => p.id));
for (const id of PATH_ORDER) if (!known.has(id)) problems.push(`path: unknown page ${id}`);
const pathJson: LearningPath = { items: PATH_ORDER.map((pageId) => ({ pageId })) };
writeJson(path.join(CONTENT, "path.json"), pathJson);
console.log(`path: ${PATH_ORDER.length} items`);

// ------------------------------------------------------------- code files ---

const links = collectCodeLinks(sourceTexts.concat(
  fs.readFileSync(path.join(SITE, "class_material.md"), "utf8"),
  fs.readFileSync(path.join(SITE, "practice_sessions.md"), "utf8"),
));
const codeIds = new Set<string>();
let missingLinks = 0;
for (const link of links) {
  const { files, missing } = expandCodeLink(link);
  if (missing) {
    missingLinks++;
    problems.push(`code link not found locally: ${link.url}`);
    continue;
  }
  for (const rel of files) {
    if (isNoiseCodeFile(rel)) continue;
    const id = `${link.repo}/${rel}`;
    if (codeIds.has(id)) continue;
    codeIds.add(id);
    const abs = path.join(REPOS[link.repo], rel);
    const out = path.join(CONTENT, "code", link.repo, ...rel.split("/")) + ".json";
    const old = readJson<CodeFile>(out);
    const branch = link.repo === "interpreters" ? "master" : "main";
    const cf: CodeFile = {
      id,
      repo: link.repo,
      path: rel,
      lang: LANG_BY_EXT[path.extname(rel)] ?? "text",
      githubUrl: `https://github.com/bguppl/${link.repo}/blob/${branch}/${rel}`,
      code: fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n"),
      annotations: old?.annotations,
      titleHe: old?.titleHe,
      descriptionHe: old?.descriptionHe,
    };
    writeJson(out, cf);
  }
}
writeJson(path.join(CONTENT, "code-index.json"), [...codeIds].sort());
console.log(`code files: ${codeIds.size} written (${missingLinks} links unresolvable)`);

// ------------------------------------------------------------------ report ---

if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  - " + p);
  process.exitCode = 1;
} else {
  console.log("\nparse: OK, no problems");
}
