// Per-page progress math, shared by the lesson view, sidebar, and home.

import type { Page } from "../types/content";
import type { ProgressState } from "./progress";

export interface PageStats {
  sectionsTotal: number;
  sectionsDone: number;
  exTotal: number;
  exDone: number;
  pct: number; // 0..100
  complete: boolean;
}

/** Distinct question ids that have revealable solution content (sections or blocks). */
export function checkpointIds(page: Page): number[] {
  const ids = new Set<number>();
  for (const s of page.sections) {
    if (s.role === "solution" && s.questionId) ids.add(s.questionId);
    for (const b of s.blocks) if (b.role === "solution" && b.questionId) ids.add(b.questionId);
  }
  return [...ids].sort((a, b) => a - b);
}

export function exerciseKeys(page: Page): string[] {
  const keys: string[] = [];
  if (page.kind === "practice") for (const q of checkpointIds(page)) keys.push(`${page.id}:q${q}`);
  for (const e of page.exercises ?? []) keys.push(`${page.id}:${e.id}`);
  return keys;
}

export function pageStats(page: Page, progress: ProgressState): PageStats {
  const sectionsTotal = page.sections.length;
  const sectionsDone = page.sections.filter((s) => progress.sections[s.id]).length;
  const keys = exerciseKeys(page);
  const exTotal = keys.length;
  const exDone = keys.filter((k) => progress.exercises[k]?.answered).length;
  const total = sectionsTotal + exTotal;
  const done = sectionsDone + exDone;
  const pct = total === 0 ? 100 : Math.round((100 * done) / total);
  return { sectionsTotal, sectionsDone, exTotal, exDone, pct, complete: total > 0 && done === total };
}
