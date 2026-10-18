// Shared pipeline logic: source enumeration, markdown lexing/splitting,
// question detection, and the interleaved learning path.
// Used by BOTH parse.ts (producer) and verify.ts (checker) — verify additionally
// proves the lexer covered 100% of each source file (token raws reconstruct it).

import { Lexer, type Token } from "marked";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Page, Section, Block, BlockType, PageKind } from "../src/types/content";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const SITE = path.join(ROOT, "sources", "site");
export const REPOS = {
  interpreters: path.join(ROOT, "sources", "interpreters"),
  practice: path.join(ROOT, "sources", "practice"),
};
export const CONTENT = path.join(ROOT, "public", "content");

export const hashOf = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 16);

// ---------------------------------------------------------------- sources ---

export interface PageMeta {
  id: string;
  kind: PageKind;
  sourcePath: string; // relative to sources/site
}

export function listSourcePages(): PageMeta[] {
  const pages: PageMeta[] = [];
  const cm = path.join(SITE, "class_material");
  for (const f of fs.readdirSync(cm).sort()) {
    if (f.endsWith(".md") && f !== "readme.md")
      pages.push({ id: `cm/${f.replace(/\.md$/, "")}`, kind: "lecture", sourcePath: `class_material/${f}` });
  }
  const ps = path.join(SITE, "practice_sessions");
  for (const f of fs.readdirSync(ps).sort()) {
    if (f.endsWith(".md"))
      pages.push({ id: `ps/${f.replace(/\.md$/, "")}`, kind: "practice", sourcePath: `practice_sessions/${f}` });
  }
  const rm = path.join(ps, "reading_material");
  for (const f of fs.readdirSync(rm).sort()) {
    if (f.endsWith(".md"))
      pages.push({ id: `reading/${f.replace(/\.md$/, "")}`, kind: "reading", sourcePath: `practice_sessions/reading_material/${f}` });
  }
  pages.push({ id: "links/useful_links", kind: "links", sourcePath: "useful_links.md" });
  return pages;
}

// ---------------------------------------------------------------- parsing ---

const SECTION_MAX_DEPTH = 3;
const QUESTION_RE = /^(?:\d+\.\s*)?(?:questions?|exercises?)\b/i;
const SOLUTION_RE = /solution/i;
const INLINE_SOLUTION_RE = /^(?:\*\*|__|#{4,6}\s*)?solutions?\b/i;

/** Some PS pages use raw HTML headings (<h1><b>…</b></h1>) instead of markdown #. */
function htmlHeading(token: Token): { depth: number; text: string } | undefined {
  if (token.type !== "html") return undefined;
  const m = token.raw.trim().match(/^<h([1-6])[^>]*>([\s\S]*?)<\/h\1>$/);
  if (!m) return undefined;
  return { depth: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "").trim() };
}

function blockTypeOf(token: Token): BlockType {
  switch (token.type) {
    case "code":
      return "code";
    case "list":
      return "list";
    case "table":
      return "table";
    case "hr":
      return "hr";
    case "paragraph":
      return /^\s*!\[/.test(token.raw) ? "image" : "prose";
    default:
      return "prose";
  }
}

/** Lex a source file into sections/blocks. Deterministic; no translation fields. */
export function parseSource(meta: PageMeta, src: string): { titleEn: string; sections: Section[]; coverageOk: boolean } {
  const text = src.replace(/\r\n/g, "\n");
  const tokens = new Lexer().lex(text);
  // Coverage: concatenated token raws must equal the source text exactly.
  const coverageOk = tokens.map((t) => t.raw).join("") === text;

  const sections: Section[] = [];
  let cur: Section = { id: "", depth: 0, headingEn: "", raw: "", blocks: [] };
  let titleEn = "";
  const flush = () => {
    if (cur.blocks.length > 0 || cur.raw !== "") sections.push(cur);
  };

  for (const token of tokens) {
    if (token.type === "space") {
      // Attach inter-block whitespace to the previous block/heading so that
      // raws reconstruct the file. Preamble whitespace attaches to section raw.
      const last = cur.blocks[cur.blocks.length - 1];
      if (last) last.en += token.raw;
      else cur.raw += token.raw;
      continue;
    }
    const hh = token.type === "heading" ? { depth: token.depth, text: token.text.trim() } : htmlHeading(token);
    if (hh && hh.depth <= SECTION_MAX_DEPTH) {
      flush();
      if (!titleEn && hh.depth === 1) titleEn = hh.text;
      cur = { id: "", depth: hh.depth, headingEn: hh.text, raw: token.raw, blocks: [] };
      continue;
    }
    cur.blocks.push({
      id: "",
      type: blockTypeOf(token),
      en: token.raw,
      hash: "",
      ...(token.type === "code" && token.lang ? { lang: token.lang } : {}),
    });
  }
  flush();

  // Assign ids + hashes (hash over the trimmed raw so trailing whitespace
  // attachment does not affect identity).
  sections.forEach((s, si) => {
    s.id = `${meta.id}:${si}`;
    s.blocks.forEach((b, bi) => {
      b.id = `${meta.id}:${si}:${bi}`;
      b.hash = hashOf(b.en.trim());
    });
  });

  if (meta.kind === "practice") tagQuestions(sections);
  if (!titleEn) titleEn = path.basename(meta.sourcePath, ".md");
  return { titleEn, sections, coverageOk };
}

/** Heuristic PS question/solution tagging — refined by hand in the JSON during content batches. */
function tagQuestions(sections: Section[]) {
  let qid = 0;
  let mode: "none" | "question" | "solution" = "none";
  for (const s of sections) {
    if (QUESTION_RE.test(s.headingEn)) {
      qid++;
      mode = "question";
      s.role = "question";
      s.questionId = qid;
    } else if (SOLUTION_RE.test(s.headingEn) && qid > 0) {
      mode = "solution";
      s.role = "solution";
      s.questionId = qid;
    } else if (s.depth > 0 && s.depth <= 2) {
      mode = "none";
    } else if (mode !== "none" && qid > 0) {
      s.role = mode;
      s.questionId = qid;
    }
    // Inline "Solution:" marker inside a question section.
    if (s.role === "question") {
      let inSolution = false;
      for (const b of s.blocks) {
        if (!inSolution && b.type === "prose" && INLINE_SOLUTION_RE.test(b.en.trim())) inSolution = true;
        if (inSolution) {
          b.role = "solution";
          b.questionId = s.questionId;
        }
      }
    }
  }
}

// ------------------------------------------------------------ code links ---

export interface CodeLink {
  repo: "interpreters" | "practice";
  relPath: string; // '' means repo root
  url: string;
}

const CODE_LINK_RE =
  /https:\/\/github\.com\/bguppl\/(interpreters|practice)(?:\/(?:blob|tree)\/[^/\s)">]+(?:\/([^\s)">#]*))?)?/g;

// Dead links in the original site, mapped to the real files (verified by hand).
const LINK_ALIASES: Record<string, string> = {
  "interpreters/test/cps/L7-tests.ts": "interpreters/test/cps/L7.test.ts",
};

export function collectCodeLinks(markdownTexts: string[]): CodeLink[] {
  const seen = new Map<string, CodeLink>();
  for (const text of markdownTexts) {
    for (const m of text.matchAll(CODE_LINK_RE)) {
      const repo = m[1] as CodeLink["repo"];
      let relPath = (m[2] ?? "").replace(/\/+$/, "");
      const aliased = LINK_ALIASES[`${repo}/${relPath}`];
      if (aliased) relPath = aliased.slice(repo.length + 1);
      const key = `${repo}/${relPath}`;
      if (!seen.has(key)) seen.set(key, { repo, relPath, url: m[0] });
    }
  }
  return [...seen.values()];
}

/** Expand a code link against the local clone: file → [file], dir → all files inside (recursive). */
/**
 * Rewrite `relPath` to the casing the file actually has on disk.
 *
 * Windows' filesystem is case-insensitive, so a link whose casing is wrong still
 * resolves here — the course site links `src/logic/substitution-ADT-tests.rkt`
 * while the repo file is `substitution-adt-tests.rkt`. Left alone that produced
 * two code-index entries pointing at one file (a duplicate in the sidebar, and a
 * 404 for whichever spelling is wrong on a case-sensitive filesystem).
 * Segments that genuinely do not exist are passed through untouched, so the
 * caller's `existsSync` check still decides what is missing.
 */
function realCasePath(base: string, relPath: string): string {
  const resolved: string[] = [];
  for (const part of relPath.split("/")) {
    let entries: string[];
    try {
      entries = fs.readdirSync(path.join(base, ...resolved));
    } catch {
      resolved.push(part);
      continue;
    }
    resolved.push(entries.find((e) => e === part) ?? entries.find((e) => e.toLowerCase() === part.toLowerCase()) ?? part);
  }
  return resolved.join("/");
}

export function expandCodeLink(link: CodeLink): { files: string[]; missing: boolean } {
  const base = REPOS[link.repo];
  if (!fs.existsSync(path.join(base, link.relPath))) return { files: [], missing: true };
  const relPath = realCasePath(base, link.relPath);
  const abs = path.join(base, relPath);
  if (fs.statSync(abs).isFile()) return { files: [relPath], missing: false };
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!/^(LICENSE|\.gitignore)$/.test(e.name)) out.push(path.relative(base, p).replace(/\\/g, "/"));
    }
  };
  walk(abs);
  return { files: out, missing: false };
}

/**
 * Files that are linked from the course site but are not readable course code:
 * binaries (a JPEG was being stored as UTF-8 mojibake and rendered as a "text"
 * code block), dependency lockfiles, and build config. Excluding them keeps the
 * code index browsable and stops us shipping garbage.
 *
 * `parse.ts` and `verify.ts` must agree on this, or verify fails with
 * "linked but not in content/code". Real course code — including the practice
 * repo's exercise files — is deliberately NOT filtered.
 */
const CODE_NOISE = [
  /\.(jpe?g|png|gif|bmp|ico|pdf|pptx?|docx?|zip|gz)$/i, // binary, never renderable as text
  /(^|\/)package-lock\.json$/,
  /(^|\/)package\.json$/,
  /(^|\/)tsconfig\.json$/,
  /(^|\/)jest\.config\.js$/,
  /(^|\/)global\.d\.ts$/,
  /(^|\/)CODE_OF_CONDUCT\.md$/i,
];

export const isNoiseCodeFile = (rel: string) => CODE_NOISE.some((re) => re.test(rel));

export const LANG_BY_EXT: Record<string, string> = {
  ".ts": "typescript",
  ".js": "javascript",
  ".rkt": "scheme",
  ".scm": "scheme",
  ".l1": "scheme",
  ".l3": "scheme",
  ".l4": "scheme",
  ".l5": "scheme",
  ".json": "json",
  ".md": "markdown",
  ".html": "html",
  ".py": "python",
};

// ---------------------------------------------------------- learning path ---

// Interleaved study order: each PS sits right after the last lecture whose
// material it exercises (mapping from the approved plan).
export const PATH_ORDER: string[] = [
  "cm/chap1",
  "cm/1.1TypescriptDatatypes",
  "cm/1.2TypescriptJSON",
  "reading/programming_paradigms_fp_ts",
  "reading/simple_loops_numpy",
  "reading/vectorizing_loops",
  "ps/ps1",
  "ps/ps1_sol",
  "cm/1.3TypescriptTypeChecking",
  "ps/ps2",
  "cm/1.4TypesAndOperations",
  "cm/1.5Monad",
  "cm/2.1Scheme-bottom-up",
  "cm/2.2Higher-Order-Functions-Let",
  "ps/ps3",
  "cm/2.3Syntax",
  "cm/2.4SyntacticOperations",
  "ps/ps4",
  "cm/2.5OperationalSemantics",
  "cm/2.6SubstitutionModel",
  "ps/ps5",
  "cm/2.7EnvironmentModel",
  "cm/2.8RecursionMutation",
  "ps/ps6",
  "cm/3.1TypeChecking",
  "cm/3.2TypeInference",
  "ps/ps7",
  "cm/3.3TypeInferenceSystem",
  "ps/ps8",
  "cm/4.1AsyncProgramming",
  "ps/ps9",
  "cm/4.2CPS",
  "cm/4.3Generators",
  "ps/ps10",
  "cm/4.4RecursionToIteration",
  "cm/5.1RelationalLogicProgramming",
  "cm/5.2LogicProgramming",
  "ps/ps11",
  "cm/5.3LPInterpreter",
  "ps/ps12",
];

// ------------------------------------------------------------------ utils ---

export function readJson<T>(p: string): T | undefined {
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export function writeJson(p: string, v: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1), "utf8");
}

// -------------------------------------------------------- code annotations ---
// These live here, not in code-worksheets.ts, because that module runs its
// generator at import time — importing it from code-apply.ts would regenerate
// (and blank) the very worksheet being applied. Keep shared helpers side-effect
// free.

export const codeWorksheetPath = (id: string) =>
  path.join(ROOT, "work", "code__" + id.replace(/[/\\]/g, "__") + ".md");

export const codeJsonPath = (id: string) =>
  path.join(CONTENT, "code", ...id.split("/")) + ".json";

/** Files we never annotate: the course's own tests, repo docs, the practice scaffold. */
export const isAnnotatable = (id: string) =>
  !/\.test\.ts$|-tests?\.rkt$|^interpreters\/test\//.test(id) &&
  !/\.md$/.test(id) &&
  !id.startsWith("practice/");

export function pageJsonPath(id: string) {
  return path.join(CONTENT, "pages", ...id.split("/")) + ".json";
}
