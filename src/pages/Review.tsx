import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../types/content";
import { loadPage, loadPath } from "../lib/content";
import { progressStore } from "../lib/progress";
import { exerciseKeys } from "../lib/pageStats";
import { Markdown } from "../components/Markdown";
import { mdToText } from "../lib/markdown";

const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);

/** All exercises/checkpoints answered wrong — the pre-exam drill list. */
export function Review() {
  const [pages, setPages] = useState<Page[]>();
  const progress = useProgress();

  useEffect(() => {
    loadPath()
      .then((p) => Promise.all(p.items.map((it) => loadPage(it.pageId))))
      .then(setPages);
  }, []);

  if (!pages) return <div className="page-pad">טוען…</div>;

  const missed: { page: Page; key: string; label: string }[] = [];
  for (const page of pages) {
    for (const key of exerciseKeys(page)) {
      if (progress.exercises[key]?.correct === false) {
        const exId = key.slice(page.id.length + 1);
        const ex = (page.exercises ?? []).find((e) => e.id === exId);
        const label = ex ? mdToText(ex.questionHe).slice(0, 120) : `שאלה ${exId.replace(/^q/, "")} בתרגול`;
        missed.push({ page, key, label });
      }
    }
  }

  return (
    <div className="page-pad review">
      <h1>🔁 חזרה על טעויות</h1>
      {missed.length === 0 ? (
        <p>אין כרגע תרגילים שסומנו כטעות. {Object.keys(progress.exercises).length === 0 ? "התחילו לפתור תרגילים ומה שתפספסו יופיע כאן." : "כל הכבוד! 🎉"}</p>
      ) : (
        <>
          <p>{missed.length} תרגילים סומנו כטעות — שווה לחזור עליהם לפני המבחן:</p>
          <ul className="missed-list">
            {missed.map((m) => (
              <li key={m.key}>
                <Link to={`/page/${m.page.id}`}>
                  <span className="missed-page">{m.page.titleHe ?? m.page.titleEn}</span>
                  <span className="missed-label">{m.label}</span>
                </Link>
                <button className="btn subtle" onClick={() => progressStore.resetExercise(m.key)}>
                  אפס וסמן לפתרון מחדש
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
