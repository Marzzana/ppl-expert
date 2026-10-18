import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type { Block, Page, Section } from "../types/content";
import { loadPage, loadPath } from "../lib/content";
import { progressStore } from "../lib/progress";
import { pageStats } from "../lib/pageStats";
import { headingSlug } from "../lib/anchors";
import { Markdown } from "../components/Markdown";
import { CodeBlock, unfence } from "../components/CodeBlock";
import { AskClaude } from "../components/AskClaude";
import { ExerciseSet } from "../components/Exercises";

const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);

// ps10-ps12 were authored in Hebrew and their source titles carry a literal
// `<br/>`. The subtitle is a plain-text node, so strip the markup rather than
// letting the tag show through.
const plainTitle = (title: string) =>
  title
    .replace(/<br\s*\/?>/gi, " — ")
    .replace(/<[^>]+>/g, "")
    .trim();

// ---------------------------------------------------------------- solution ---

function SolutionReveal({
  qid,
  pageId,
  revealed,
  onReveal,
  children,
}: {
  qid: number;
  pageId: string;
  revealed: boolean;
  onReveal: () => void;
  children: ReactNode;
}) {
  const progress = useProgress();
  const key = `${pageId}:q${qid}`;
  const result = progress.exercises[key];
  const open = revealed || !!result?.answered;

  return (
    <div className="solution-reveal">
      {!open ? (
        <button className="btn reveal" onClick={onReveal}>
          🔒 נסו לפתור לבד — ואז הציגו את הפתרון
        </button>
      ) : (
        <>
          <div className="solution-label">פתרון</div>
          {children}
          {!result?.answered && (
            <div className="assess">
              <span>הצלחתם לבד?</span>
              <button className="btn good" onClick={() => progressStore.setExercise(key, { answered: true, correct: true })}>
                כן ✓
              </button>
              <button className="btn bad" onClick={() => progressStore.setExercise(key, { answered: true, correct: false })}>
                לא ✗
              </button>
            </div>
          )}
          {result?.answered && (
            <div className="exercise-footer">
              <span className={result.correct === false ? "tag-wrong" : "tag-right"}>
                {result.correct === false ? "סומן לחזרה" : "נפתר ✓"}
              </span>
              <button className="btn subtle" onClick={() => progressStore.resetExercise(key)}>
                אפס
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ blocks ---

function BlockView({ block, dir, resourceBase }: { block: Block; dir: "rtl" | "ltr"; resourceBase: string }) {
  if (block.type === "code") {
    const { code, lang } = unfence(block.en);
    return (
      <>
        <CodeBlock code={code} lang={block.lang ?? lang} />
        {block.noteHe && (
          <div className="code-note">
            <Markdown src={block.noteHe} dir="rtl" resourceBase={resourceBase} />
          </div>
        )}
      </>
    );
  }
  if (block.type === "hr") return <hr />;
  const src = dir === "rtl" && block.he ? block.he : block.en;
  const actualDir = dir === "rtl" && block.he ? "rtl" : "ltr";
  return <Markdown src={src} dir={actualDir} resourceBase={resourceBase} />;
}

/** Render a section's blocks, folding consecutive solution blocks into reveals. */
function SectionBlocks({
  section,
  page,
  dir,
  resourceBase,
  revealedQids,
  reveal,
}: {
  section: Section;
  page: Page;
  dir: "rtl" | "ltr";
  resourceBase: string;
  revealedQids: Set<number>;
  reveal: (q: number) => void;
}) {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < section.blocks.length) {
    const b = section.blocks[i];
    if (b.role === "solution" && b.questionId && section.role !== "solution") {
      const qid = b.questionId;
      const group: Block[] = [];
      while (i < section.blocks.length && section.blocks[i].role === "solution" && section.blocks[i].questionId === qid) {
        group.push(section.blocks[i]);
        i++;
      }
      out.push(
        <SolutionReveal key={`sol-${qid}-${i}`} qid={qid} pageId={page.id} revealed={revealedQids.has(qid)} onReveal={() => reveal(qid)}>
          {group.map((g) => (
            <BlockView key={g.id} block={g} dir={dir} resourceBase={resourceBase} />
          ))}
        </SolutionReveal>,
      );
      continue;
    }
    out.push(<BlockView key={b.id} block={b} dir={dir} resourceBase={resourceBase} />);
    i++;
  }
  return <>{out}</>;
}

// ----------------------------------------------------------------- section ---

function SectionCube({
  section,
  page,
  resourceBase,
  revealedQids,
  reveal,
}: {
  section: Section;
  page: Page;
  resourceBase: string;
  revealedQids: Set<number>;
  reveal: (q: number) => void;
}) {
  const progress = useProgress();
  const [showOriginal, setShowOriginal] = useState(false);
  const done = !!progress.sections[section.id];
  const hasTranslation = section.headingHe !== undefined || section.blocks.some((b) => b.he !== undefined);
  const dir: "rtl" | "ltr" = hasTranslation && !showOriginal ? "rtl" : "ltr";
  const heading = dir === "rtl" && section.headingHe ? section.headingHe : section.headingEn;
  const H = section.depth <= 1 ? "h1" : section.depth === 2 ? "h2" : "h3";

  return (
    <section className={"cube" + (done ? " done" : "") + (section.role === "question" ? " question-cube" : "")}>
      <div className="cube-head">
        {section.role === "question" && <span className="q-badge">שאלה {section.questionId}</span>}
        {heading && (
          // id comes from the ORIGINAL heading text — that is what the page's own
          // table-of-contents anchors were generated from. See lib/anchors.ts.
          <H className="cube-title" id={headingSlug(section.headingEn)}>
            {heading}
          </H>
        )}
        <div className="cube-tools">
          {hasTranslation && (
            <button className="btn subtle" onClick={() => setShowOriginal((v) => !v)}>
              {showOriginal ? "חזרה לעברית" : "מקור באנגלית"}
            </button>
          )}
          <AskClaude page={page} section={section} />
        </div>
      </div>
      <SectionBlocks section={section} page={page} dir={dir} resourceBase={resourceBase} revealedQids={revealedQids} reveal={reveal} />
      <div className="cube-footer">
        <button className={"btn mark-done" + (done ? " on" : "")} onClick={() => progressStore.toggleSection(section.id)}>
          {done ? "✓ סומן כנקרא" : "סיימתי לקרוא"}
        </button>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------- page ---

export function Lesson() {
  const params = useParams();
  const id = `${params.group}/${params["*"] ?? params.name}`;
  const [page, setPage] = useState<Page>();
  const [error, setError] = useState<string>();
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [revealedQids, setRevealedQids] = useState<Set<number>>(new Set());
  const progress = useProgress();

  useEffect(() => {
    setPage(undefined);
    setError(undefined);
    setRevealedQids(new Set());
    loadPage(id).then(setPage, (e) => setError(String(e)));
    loadPath().then((p) => setPathIds(p.items.map((it) => it.pageId)));
    window.scrollTo(0, 0);
  }, [id]);

  if (error) return <div className="page-pad">שגיאה בטעינת הדף: {error}</div>;
  if (!page) return <div className="page-pad">טוען…</div>;

  const stats = pageStats(page, progress);
  const resourceBase = page.sourcePath.startsWith("class_material") ? "class_material" : "practice_sessions";
  const idx = pathIds.indexOf(page.id);
  const prev = idx > 0 ? pathIds[idx - 1] : undefined;
  const next = idx >= 0 && idx < pathIds.length - 1 ? pathIds[idx + 1] : undefined;
  const reveal = (q: number) => setRevealedQids((s) => new Set(s).add(q));

  // whole sections with role=solution — group consecutive runs per question
  const rendered: ReactNode[] = [];
  let i = 0;
  while (i < page.sections.length) {
    const s = page.sections[i];
    if (s.role === "solution" && s.questionId) {
      const qid = s.questionId;
      const group: Section[] = [];
      while (i < page.sections.length && page.sections[i].role === "solution" && page.sections[i].questionId === qid) {
        group.push(page.sections[i]);
        i++;
      }
      rendered.push(
        <SolutionReveal key={`solsec-${qid}`} qid={qid} pageId={page.id} revealed={revealedQids.has(qid)} onReveal={() => reveal(qid)}>
          {group.map((gs) => (
            <SectionCube key={gs.id} section={gs} page={page} resourceBase={resourceBase} revealedQids={revealedQids} reveal={reveal} />
          ))}
        </SolutionReveal>,
      );
      continue;
    }
    rendered.push(<SectionCube key={s.id} section={s} page={page} resourceBase={resourceBase} revealedQids={revealedQids} reveal={reveal} />);
    i++;
  }

  const allSectionsRead = stats.sectionsTotal > 0 && stats.sectionsDone === stats.sectionsTotal;

  return (
    <div className="lesson">
      <div className="page-progress" role="progressbar" aria-valuenow={stats.pct}>
        <div className="page-progress-fill" style={{ width: `${stats.pct}%` }} />
        <span className="page-progress-label">
          {stats.pct}% · {stats.sectionsDone}/{stats.sectionsTotal} קטעים
          {stats.exTotal > 0 ? ` · ${stats.exDone}/${stats.exTotal} תרגילים` : ""}
        </span>
      </div>

      <header className="lesson-header">
        <h1>{page.titleHe ?? plainTitle(page.titleEn)}</h1>
        {page.titleHe && <div className="subtitle" dir="ltr">{plainTitle(page.titleEn)}</div>}
        {!page.translated && page.kind !== "links" && <div className="untranslated-badge">טרם תורגם — מוצג המקור באנגלית</div>}
        <div className="header-tools">
          <AskClaude page={page} />
          {stats.sectionsTotal > 0 && (
            // Marks reading progress only — exercises are meant to be answered, not skipped.
            <button
              className="btn subtle"
              onClick={() =>
                progressStore.setSections(
                  page.sections.map((s) => s.id),
                  !allSectionsRead,
                )
              }
            >
              {allSectionsRead ? "בטל סימון קריאה" : "סמן הכל כנקרא"}
            </button>
          )}
        </div>
      </header>

      {rendered}

      <ExerciseSet page={page} resourceBase={resourceBase} />

      <nav className="pager">
        {prev && (
          <Link className="pager-link" to={`/page/${prev}`}>
            → הקודם
          </Link>
        )}
        <Link className="pager-link" to="/">
          מסך הבית
        </Link>
        {next && (
          <Link className={"pager-link next" + (stats.complete ? " ready" : "")} to={`/page/${next}`}>
            הבא ←
          </Link>
        )}
      </nav>
    </div>
  );
}
