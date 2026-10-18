// Singleton shiki highlighter (loaded once, lazily).

import { createHighlighter, type Highlighter } from "shiki";

let ready: Promise<Highlighter> | undefined;

export function getHighlighter(): Promise<Highlighter> {
  if (!ready) {
    ready = createHighlighter({
      themes: ["github-light"],
      langs: ["typescript", "javascript", "scheme", "json", "markdown", "html", "python", "bash"],
    });
  }
  return ready;
}

export function normalizeLang(lang?: string): string {
  const l = (lang ?? "").toLowerCase();
  if (["ts", "typescript"].includes(l)) return "typescript";
  if (["js", "javascript", "node"].includes(l)) return "javascript";
  if (["scheme", "racket", "rkt", "lisp"].includes(l)) return "scheme";
  if (["py", "python"].includes(l)) return "python";
  if (["sh", "bash", "shell"].includes(l)) return "bash";
  if (["json", "markdown", "md", "html"].includes(l)) return l === "md" ? "markdown" : l;
  return "text";
}
