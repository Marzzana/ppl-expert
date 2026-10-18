// Shared content model — produced by pipeline/, consumed by the app.
// Every block keeps the English source (en) and its hash so verify.ts can
// prove nothing was dropped; `he` fields are filled in by translation batches.

export type BlockType =
  | "prose" // paragraph / blockquote / html
  | "code"
  | "list"
  | "table"
  | "image"
  | "hr";

export interface Block {
  id: string; // pageId:blockIndex
  type: BlockType;
  /** Raw markdown of the block, verbatim from source. */
  en: string;
  /** Hebrew translation (markdown). Absent until translated. Code blocks never have one. */
  he?: string;
  /** Code blocks: language tag from the fence. */
  lang?: string;
  /** Code blocks: Hebrew walkthrough note (markdown). */
  noteHe?: string;
  /** sha256 (hex, first 16 chars) of `en` — verification anchor. */
  hash: string;
  /** Marks this block as part of a PS question/solution structure. */
  role?: "question" | "solution";
  /** For role blocks: which question on the page they belong to (1-based). */
  questionId?: number;
}

export interface Section {
  id: string; // pageId:sectionIndex
  /** Heading depth (1-4); 0 for the implicit preamble section. */
  depth: number;
  headingEn: string;
  headingHe?: string;
  /** Verbatim markdown of the heading line (empty for preamble) — used by verify.ts to reconstruct the source file. */
  raw: string;
  /** PS pages: this section is a question/solution section (detected structurally, refined per page). */
  role?: "question" | "solution";
  questionId?: number;
  blocks: Block[];
}

export type ExerciseType = "mcq" | "code-reading" | "open";

export interface Exercise {
  id: string;
  type: ExerciseType;
  /** Question text, Hebrew markdown (may embed code fences). */
  questionHe: string;
  /** MCQ options (Hebrew markdown). */
  options?: string[];
  /** Index of correct option for mcq. */
  correct?: number;
  /** Model answer / expected output (Hebrew markdown), for code-reading and open. */
  answerHe?: string;
  /** Shown after answering: why right/wrong (Hebrew markdown). */
  explanationHe?: string;
}

export type PageKind = "lecture" | "practice" | "reading" | "links";

export interface Page {
  id: string; // e.g. "cm/2.1Scheme-bottom-up" or "ps/ps3"
  kind: PageKind;
  /** Source file path relative to sources/site/. */
  sourcePath: string;
  titleEn: string;
  titleHe?: string;
  translated: boolean;
  sections: Section[];
  /** Lecture pages: authored exercise set (final "תרגול" cube). */
  exercises?: Exercise[];
}

export interface CodeFile {
  id: string; // e.g. "L5/L5-ast.ts"
  repo: "interpreters" | "practice";
  path: string; // path within repo
  lang: string;
  githubUrl: string;
  code: string;
  /** Hebrew annotations keyed by 1-based start line: markdown notes shown between code segments. */
  annotations?: { line: number; noteHe: string }[];
  titleHe?: string;
  descriptionHe?: string;
}

export interface TocEntry {
  pageId: string;
  titleEn: string;
  titleHe?: string;
}

export interface TocChapter {
  titleEn: string;
  titleHe?: string;
  entries: TocEntry[];
}

export interface Toc {
  classMaterial: TocChapter[];
  practiceSessions: TocEntry[];
  /** Code files linked from class_material.md, grouped as on the original page. */
  codeGroups: { titleEn: string; files: string[] }[];
}

export interface PathItem {
  pageId: string;
  /** Why this PS sits here (shown as a small hint), Hebrew. */
  noteHe?: string;
}

export interface LearningPath {
  items: PathItem[];
}
