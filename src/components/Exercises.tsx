import { useState, useSyncExternalStore } from "react";
import type { Exercise, Page } from "../types/content";
import { progressStore } from "../lib/progress";
import { Markdown } from "./Markdown";

const useProgress = () => useSyncExternalStore(progressStore.subscribe, progressStore.get);

/** One authored exercise (mcq / code-reading / open). */
function ExerciseItem({ ex, storeKey, resourceBase }: { ex: Exercise; storeKey: string; resourceBase: string }) {
  const progress = useProgress();
  const result = progress.exercises[storeKey];
  const [picked, setPicked] = useState<number>();
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={"exercise" + (result?.answered ? (result.correct === false ? " wrong" : " done") : "")}>
      <Markdown src={ex.questionHe} dir="rtl" resourceBase={resourceBase} />

      {ex.type === "mcq" && ex.options && (
        <div className="mcq-options">
          {ex.options.map((opt, i) => {
            const answered = !!result?.answered;
            // after answering, fall back to the stored pick so a wrong choice survives a reload
            const chosen = answered ? result.picked : picked;
            const cls = [
              "mcq-option",
              chosen === i ? "picked" : "",
              answered && i === ex.correct ? "correct" : "",
              answered && chosen === i && i !== ex.correct ? "wrong" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={i}
                className={cls}
                disabled={!!result?.answered}
                onClick={() => setPicked(i)}
              >
                <Markdown src={opt} dir="rtl" resourceBase={resourceBase} />
              </button>
            );
          })}
          {!result?.answered && (
            <button
              className="btn primary"
              disabled={picked === undefined}
              onClick={() => progressStore.setExercise(storeKey, { answered: true, correct: picked === ex.correct, picked })}
            >
              בדיקה
            </button>
          )}
        </div>
      )}

      {(ex.type === "code-reading" || ex.type === "open") && (
        <div className="open-exercise">
          {!revealed && !result?.answered && (
            <button className="btn" onClick={() => setRevealed(true)}>
              ניסיתי — הצג תשובה
            </button>
          )}
          {(revealed || result?.answered) && ex.answerHe && (
            <div className="model-answer">
              <div className="model-answer-label">תשובה:</div>
              <Markdown src={ex.answerHe} dir="rtl" resourceBase={resourceBase} />
            </div>
          )}
          {revealed && !result?.answered && (
            <div className="assess">
              <span>איך הלך?</span>
              <button className="btn good" onClick={() => progressStore.setExercise(storeKey, { answered: true, correct: true })}>
                צדקתי ✓
              </button>
              <button className="btn bad" onClick={() => progressStore.setExercise(storeKey, { answered: true, correct: false })}>
                טעיתי ✗
              </button>
            </div>
          )}
        </div>
      )}

      {result?.answered && ex.explanationHe && (
        <div className={"explanation" + (result.correct === false ? " wrong" : "")}>
          <Markdown src={ex.explanationHe} dir="rtl" resourceBase={resourceBase} />
        </div>
      )}
      {result?.answered && (
        <div className="exercise-footer">
          <span className={result.correct === false ? "tag-wrong" : "tag-right"}>
            {result.correct === false ? "טעית — שווה לחזור על זה" : "נענה נכון"}
          </span>
          <button className="btn subtle" onClick={() => progressStore.resetExercise(storeKey)}>
            נסה שוב
          </button>
        </div>
      )}
    </div>
  );
}

/** The final "תרגול" cube of a lecture page. */
export function ExerciseSet({ page, resourceBase }: { page: Page; resourceBase: string }) {
  if (!page.exercises?.length) return null;
  return (
    <section className="cube exercise-cube" id="exercises">
      <div className="cube-head">
        <h2>תרגול — בדקו את עצמכם</h2>
      </div>
      {page.exercises.map((ex) => (
        <ExerciseItem key={ex.id} ex={ex} storeKey={`${page.id}:${ex.id}`} resourceBase={resourceBase} />
      ))}
    </section>
  );
}
