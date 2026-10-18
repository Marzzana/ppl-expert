import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../types/content";
import { loadPage, loadPath, chapterOf } from "../lib/content";
import { progressStore } from "../lib/progress";
import { pageStats } from "../lib/pageStats";

const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);

const KIND_ICON: Record<string, string> = { lecture: "📖", practice: "✏️", reading: "📄", links: "🔗" };
const CHAPTER_NAMES: Record<string, string> = {
  "1": "פרק 1 — תכנות פונקציונלי מעשי",
  "2": "פרק 2 — תחביר וסמנטיקה עם Scheme",
  "3": "פרק 3 — בדיקת טיפוסים והסקת טיפוסים",
  "4": "פרק 4 — מבני בקרה",
  "5": "פרק 5 — תכנות לוגי",
};

/** First-run state: the content JSONs have not been generated yet. */
function NoContent() {
  return (
    <div className="page-pad">
      <h1>התוכן טרם נוצר</h1>
      <p>
        תיקיית <code>public/content/</code> ריקה. היא נבנית מחומרי הקורס ואינה מגיעה עם ה-repo.
        הריצו את שלב ה-setup ב-<code>README.md</code>:
      </p>
      <pre className="ltr-block">{`npm run setup
npm run pipeline:parse`}</pre>
    </div>
  );
}

export function Home() {
  const [items, setItems] = useState<{ id: string; page: Page }[]>();
  const [failed, setFailed] = useState(false);
  const progress = useProgress();

  useEffect(() => {
    loadPath()
      .then((p) => Promise.all(p.items.map(async (it) => ({ id: it.pageId, page: await loadPage(it.pageId) }))))
      .then(setItems)
      .catch(() => setFailed(true));
  }, []);

  // A fresh clone has no public/content/ — it is generated from the course sources by
  // the pipeline, and is deliberately not committed. Say so instead of spinning forever.
  if (failed) return <NoContent />;
  if (!items) return <div className="page-pad">טוען…</div>;

  const stats = items.map((it) => ({ ...it, s: pageStats(it.page, progress) }));
  const overall = Math.round(stats.reduce((a, x) => a + x.s.pct, 0) / stats.length);
  const firstIncomplete = stats.find((x) => !x.s.complete);
  let lastChapter = "";

  return (
    <div className="home">
      <header className="hero">
        <h1>PPL Expert</h1>
        <p className="hero-sub">מסלול הלמידה המלא של הקורס — הרצאות ותרגולים, לפי הסדר, בעברית.</p>
        <div className="overall">
          <div className="overall-bar">
            <div className="overall-fill" style={{ width: `${overall}%` }} />
          </div>
          <div className="overall-label">{overall}% מהקורס הושלם</div>
        </div>
        {firstIncomplete && (
          <Link className="btn primary big" to={`/page/${firstIncomplete.id}`}>
            המשך ללמוד: {firstIncomplete.page.titleHe ?? firstIncomplete.page.titleEn} ←
          </Link>
        )}
      </header>

      <ol className="path-list">
        {stats.map((x, i) => {
          const ch = chapterOf(x.id);
          const header = ch && ch !== lastChapter ? CHAPTER_NAMES[ch] : undefined;
          if (ch) lastChapter = ch;
          return (
            <li key={x.id}>
              {header && <div className="chapter-header">{header}</div>}
              <Link className={"path-item" + (x.s.complete ? " complete" : "")} to={`/page/${x.id}`}>
                <span className="path-icon">{x.s.complete ? "✅" : KIND_ICON[x.page.kind]}</span>
                <span className="path-title">
                  {x.page.titleHe ?? x.page.titleEn}
                  {!x.page.translated && <span className="mini-tag">EN</span>}
                </span>
                <span className="path-pct">{x.s.pct}%</span>
                <span className="path-bar">
                  <span className="path-bar-fill" style={{ width: `${x.s.pct}%` }} />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
