<div align="center">

# PPL Expert

**פלטפורמת לימוד בעברית לקורס "עקרונות שפות תכנות" (PPL) באוניברסיטת בן־גוריון**

The complete BGU *Principles of Programming Languages* course — translated to Hebrew, reorganised
into one study path, with progress tracking, exercises, and a Hebrew walkthrough on every block of
code.

Runs locally in your browser. No account, no server, no API key.

</div>

---

## התקנה

דרוש [Node.js](https://nodejs.org/) בגרסה 20.11 ומעלה.

```bash
git clone https://github.com/Marzzana/ppl-expert.git
cd ppl-expert
npm install
npm run dev
```

פותחים את http://localhost:5199 — וזהו. **כל הקורס כבר מתורגם ונמצא בתוך ה-repo**; אין שלב נוסף,
אין מה להוריד, ואין צורך בחיבור לאינטרנט אחרי ההתקנה.

ההתקדמות נשמרת בדפדפן (localStorage). בסרגל הצד יש כפתורי **גיבוי/שחזור** לייצוא וייבוא שלה כקובץ,
אז מעבר למחשב אחר לא מאבד כלום.

> [!IMPORTANT]
> **זו אינה פלטפורמה רשמית של הקורס.** התרגום, ההסברים, התרגילים ותשובות המודל נכתבו על ידי סטודנט
> (בעזרת Claude), ולא נבדקו או אושרו על ידי סגל הקורס. במקרה של סתירה — **אתר הקורס הוא הקובע**.
> תשובות מודל לשאלות שאין להן פתרון רשמי מסומנות ככאלה בתוך האפליקציה.

---

## What this is

The official course site ([bguppl.github.io/interpreters](https://bguppl.github.io/interpreters/))
is thorough and good, and also hard to *study* from: very long English pages, no notion of where you
are in the course, no progress tracking, and a lot of code presented without a walkthrough. For a
native Hebrew speaker preparing for the exam, each page is a wall.

PPL Expert reorganises exactly the same material into something you can work through: in Hebrew, in
the order you should actually study it, in sections small enough to finish in one sitting, with every
code block explained and every lecture ending in exercises.

The design constraint that shaped everything: **English technical vocabulary must survive.** You sit
the exam in English and read code in English, so terms stay visible (`סְגוֹר (Closure)` on first use),
code is never translated, and every section can be flipped back to the original English.

| | |
|---|---|
| 📖 **Full Hebrew translation** | Every page of the course, section by section, with a per-section "show original" toggle. |
| 🧭 **One interleaved learning path** | Lectures and practice sessions merged into the order you should study them, instead of two separate lists. |
| ✅ **Progress tracking** | Per section, per page and per course, with export/import so it survives a new browser or machine. |
| ✏️ **Exercises everywhere** | Exam-oriented questions at the end of every lecture; practice-session questions become solve-then-reveal checkpoints. Missed items collect into a review screen. |
| 💬 **Annotated code** | Every code block in every lesson carries a Hebrew walkthrough, and the course's own source files are browsable with syntax highlighting and line-anchored notes. |
| 🤖 **Ask Claude** | One click copies the current section — English, Hebrew and code — as a ready-made prompt to paste into claude.ai. |
| ↔️ **Real RTL** | Hebrew prose right-to-left, code and math left-to-right, bidi-isolated so identifiers never scramble mid-sentence. |

<!-- Want a screenshot here? Drop a PNG at docs/screenshot-home.png and uncomment the next line:
![PPL Expert](docs/screenshot-home.png)
-->

### What's in the box

- **41 pages** — 5 chapters of lectures, 12 practice sessions, reading material — across **688 sections**, all translated
- **1,250** Hebrew notes on code blocks · **214** authored exercises · a **589**-term glossary keeping terminology identical across the whole course
- **125** of the course's source files browsable, **87** of them fully annotated (**432** line-anchored notes)
- Chapters 1–5, lectures *and* practice sessions: TypeScript and FP · Scheme syntax & semantics · type checking and inference · CPS, generators and async · logic programming and the LP interpreter

## What's inside

```
src/
  pages/       Home (learning path) · Lesson · CodeView · Review
  components/  Sidebar · Markdown · CodeBlock · Exercises · AskClaude
  lib/         content loading · progress store · markdown+KaTeX · shiki · anchors
pipeline/      parse · worksheets · apply · code-worksheets · code-apply · verify · audit
public/content/  the generated course: pages, code, glossary, learning path
work/          GUIDE.md · GUIDE-CODE.md — the authoring briefs
```

Stack: React 18 + TypeScript + Vite, `marked` + KaTeX for rendering, `shiki` for highlighting, and
`HashRouter` so `npm run build` produces a `dist/` you can host on any static server. No backend —
progress lives in `localStorage`.

## Rebuilding the content (optional)

You do not need this to study — `public/content/` is committed and ready. It matters only if the
course site changes, or if you want to translate something yourself.

```bash
npm run setup            # clone the course repos into sources/
npm run pipeline:parse   # sources/ -> public/content/*.json
```

Sources are never edited, and generated content is never hand-edited. Everything flows one way:

```
sources/  --parse-->  public/content/*.json  --worksheets-->  work/*.md
                              ^                                   |
                              +------------- apply ---------------+
```

| command | what it does |
|---|---|
| `npm run setup` | clone the course repos into `sources/` (idempotent — existing clones are left alone) |
| `npm run pipeline:parse` | `sources/` → `public/content/` JSON. **Idempotent**: re-running preserves every existing translation by matching each block on its source hash, so the course can be re-pulled without losing work |
| `npm run pipeline:worksheets` | export fill-in-the-blank translation worksheets to `work/` |
| `npm run pipeline:apply -- <pageId>` | merge a filled worksheet back into the page JSON, with validation |
| `npm run pipeline:code-worksheets -- <filter>` / `:code-apply` | the same loop, for annotating the course's source files |
| `npm run pipeline:verify` | proves `public/content/` reproduces **100%** of the sources — nothing dropped, no code altered |
| `npm run pipeline:audit` | proves the **Hebrew layer** is complete and self-consistent |

Two different guarantees, deliberately kept separate:

- **`verify`** is about the *sources*. Its lexer-coverage check requires that the concatenated raw
  tokens of every parsed page reconstruct the original file byte-for-byte, and that every code block
  stays identical to the repo file. If the course updates a page, verify is what catches the drift.
- **`audit`** is about *us*. It sweeps ~7,500 Hebrew-authored fields for glossary drift (one spelling
  per term, everywhere), exercise-schema errors, annotation line ranges, broken in-page anchors,
  headings buried inside raw HTML blocks where markdown will never parse them, and dead image URLs.

Authoring conventions — translation style, how to write a code note, what must never be touched — are
in [`work/GUIDE.md`](work/GUIDE.md) (pages) and [`work/GUIDE-CODE.md`](work/GUIDE-CODE.md) (source files).

## How this was built with Claude Code

I built this with [Claude Code](https://claude.com/claude-code) across a handful of long sessions —
**247 commits**, and roughly 7,500 authored Hebrew fields. I wrote essentially none of the code by
hand; my job was deciding what the thing should be, and catching Claude when it was confidently wrong.

What I took away from doing it:

**The app was the easy half.** A React reader with progress tracking is an afternoon's work. The real
problem is that translating 41 dense technical pages is far more work than fits in any one session —
so the project became a *pipeline* whose whole job is making an LLM a reliable translator at scale.

**Generated content had to be unforgeable.** The rule that saved the project: `public/content/**` is
never hand-edited. Claude fills slots in a worksheet, `apply` merges them back with validation, and
`verify` independently proves the English sources survived untouched. When translating, a model's
instinct is to "improve" the code or quietly drop a bullet point — a byte-equality check on every code
block and a lexer-coverage check on every page make that impossible rather than merely discouraged.

**Idempotency bought restartability.** `parse` matches blocks by source hash, so re-running it against
updated sources keeps every translation already written. Combined with committing every 2–4 sections,
a session dying mid-page costs minutes instead of hours.

**Consistency needed its own tool.** Across 41 pages the same English term drifts into three different
Hebrew spellings — not an error any single session can see, because each one looks fine on its own.
The glossary plus the `audit` sweep turns that into a failing check. Several rules in `audit.ts` exist
only because a bug got through once and I didn't want to have to re-find it.

**Handoffs beat memory.** Every session ended by updating a running `HANDOFF.md` with the real state,
the traps already hit, and the exact next command to run. The next session started by reading it. That
file — a working log, kept out of this repo — is the reason the work composed instead of restarting.

**The QA sweep was worth more than more content.** One pass over the finished app found six real bugs —
including in-page table-of-contents links that blanked the entire page under `HashRouter`, and four
permanently broken images pointing at GitHub's retired math-rendering proxy. `pipeline:audit` is that
sweep, made repeatable.

## Credits

The course — its lesson pages, its interpreters, its practice sessions — is the work of
**Michael Elhadad** and the BGU PPL course staff, published at
[`bguppl/interpreters`](https://github.com/bguppl/interpreters) and
[`bguppl/practice`](https://github.com/bguppl/practice) under the MIT License. The course's source
files are included here byte-for-byte unmodified, with the Hebrew commentary stored alongside them
rather than inside them.

Full attribution and the upstream license text: [`NOTICE.md`](NOTICE.md).

This is an unofficial study aid. It is not written, reviewed or endorsed by the course staff — if it
disagrees with the course, the course is right.

## License

[MIT](LICENSE) for the app, the pipeline and the Hebrew layer written on top of the course.
The underlying course material is MIT too — see [`NOTICE.md`](NOTICE.md).
