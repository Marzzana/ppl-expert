import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { Page } from "../types/content";
import { loadPage, loadPath, chapterOf } from "../lib/content";
import { progressStore } from "../lib/progress";
import { pageStats } from "../lib/pageStats";

const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);
const KIND_ICON: Record<string, string> = { lecture: "📖", practice: "✏️", reading: "📄" };

export function Sidebar() {
  const [items, setItems] = useState<{ id: string; page: Page }[]>();
  const progress = useProgress();
  const location = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPath()
      .then((p) => Promise.all(p.items.map(async (it) => ({ id: it.pageId, page: await loadPage(it.pageId) }))))
      .then(setItems)
      // No content yet (fresh clone, before the pipeline runs) — Home explains it.
      .catch(() => setItems([]));
  }, []);

  let lastChapter = "";

  return (
    <aside className="sidebar">
      <NavLink to="/" className="sidebar-brand">
        <span className="brand-logo">λ</span> PPL Expert
      </NavLink>

      <nav className="sidebar-nav">
        {items?.map((x) => {
          const s = pageStats(x.page, progress);
          const ch = chapterOf(x.id);
          const header = ch && ch !== lastChapter ? `פרק ${ch}` : undefined;
          if (ch) lastChapter = ch;
          return (
            <div key={x.id}>
              {header && <div className="side-chapter">{header}</div>}
              <NavLink
                to={`/page/${x.id}`}
                className={({ isActive }) => "side-item" + (isActive ? " active" : "") + (s.complete ? " complete" : "")}
              >
                <span className="side-icon">{s.complete ? "✓" : KIND_ICON[x.page.kind] ?? "•"}</span>
                <span className="side-title">{x.page.titleHe ?? x.page.titleEn}</span>
                {s.pct > 0 && !s.complete && <span className="side-pct">{s.pct}%</span>}
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-extras">
        <NavLink to="/code" className={({ isActive }) => "side-item" + (isActive && location.pathname === "/code" ? " active" : "")}>
          <span className="side-icon">🗂️</span> קבצי הקוד של הקורס
        </NavLink>
        <NavLink to="/page/links/useful_links" className={({ isActive }) => "side-item" + (isActive ? " active" : "")}>
          <span className="side-icon">🔗</span> קישורים שימושיים
        </NavLink>
        <NavLink to="/review" className={({ isActive }) => "side-item" + (isActive ? " active" : "")}>
          <span className="side-icon">🔁</span> חזרה על טעויות
        </NavLink>
        <div className="side-io">
          <button
            className="btn subtle"
            onClick={() => {
              const blob = new Blob([progressStore.export()], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "ppl-progress.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            גיבוי התקדמות
          </button>
          <button className="btn subtle" onClick={() => fileInput.current?.click()}>
            שחזור
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                progressStore.import(await f.text());
                alert("ההתקדמות שוחזרה בהצלחה");
              } catch (err) {
                alert("שחזור נכשל: " + err);
              }
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </aside>
  );
}
