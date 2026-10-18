// Runtime content loading from /content/*.json (produced by the pipeline).

import type { Page, CodeFile, Toc, LearningPath } from "../types/content";

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(url: string): Promise<T> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      // The dev server and any SPA host answer unknown paths with index.html and a
      // 200, so a missing page would otherwise surface as a raw JSON parse error.
      const isJson = (r.headers.get("content-type") ?? "").includes("json");
      if (!r.ok || !isJson) throw new Error("לא נמצא");
      return r.json();
    });
    // Don't let a transient failure poison the cache for the rest of the session.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<T>;
}

export const loadPage = (id: string) => fetchJson<Page>(`/content/pages/${id}.json`);
export const loadCodeFile = (id: string) => fetchJson<CodeFile>(`/content/code/${id}.json`);
export const loadToc = () => fetchJson<Toc>("/content/toc.json");
export const loadPath = () => fetchJson<LearningPath>("/content/path.json");
export const loadCodeIndex = () => fetchJson<string[]>("/content/code-index.json");

/** Chapter label for grouping path items, from a pageId like cm/2.3Syntax. */
export function chapterOf(pageId: string): string | undefined {
  const m = pageId.match(/^cm\/(\d)\./);
  if (m) return m[1];
  if (pageId === "cm/chap1") return "1";
  return undefined;
}
