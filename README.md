<div align="center">

# PPL Expert

**פלטפורמת לימוד בעברית לקורס "עקרונות שפות תכנות" (PPL) באוניברסיטת בן־גוריון**

A Hebrew study platform for Ben-Gurion University's *Principles of Programming Languages* course —
a content pipeline that turns the official English course site into a translated, annotated,
progress-tracked reader app.

Built end-to-end with [Claude Code](https://claude.com/claude-code).

</div>

---

> ### ⚠️ No course material ships in this repository
>
> This repo contains **the engine, not the course**: the reader app, the content pipeline, and the
> authoring guides. Every lesson page, figure and interpreter source file is fetched from the
> course's own public repositories at setup time and generated into `public/content/`, which is
> gitignored. Nothing that belongs to the course staff is committed here.
> See [What is *not* in here](#what-is-not-in-here).

## Why this exists

The official course site ([bguppl.github.io/interpreters](https://bguppl.github.io/interpreters/))
is thorough and good, and also hard to *study* from: very long English pages, no notion of where you
are in the course, no progress tracking, and a lot of code presented without a walkthrough. For a
native Hebrew speaker preparing for the exam, each page is a wall.

PPL Expert reorganises exactly the same material into something you can work through: in Hebrew, in
the order you should actually study it, in sections small enough to finish in one sitting, with every
code block explained and every lecture ending in exercises.

The design constraint that shaped everything: **English technical vocabulary must survive.** You sit
the exam in English and read code in English, so terms stay visible (`סְגוֹר (Closure)` on first use),
code is never translated, and every section can be flipped back to the original.

## What it does

| | |
|---|---|
| 📖 **Full Hebrew translation** | Every page of the course, section by section, with a per-section "show original" toggle. |
| 🧭 **One interleaved learning path** | Lectures and practice sessions merged into the order you should study them, instead of two separate lists. |
| ✅ **Progress tracking** | Per section, per page and per course, stored in `localStorage`, with export/import so it survives a new browser. |
| ✏️ **Exercises everywhere** | Exam-oriented questions at the end of every lecture; practice-session questions become solve-then-reveal checkpoints. Missed items collect into a review screen. |
| 💬 **Annotated code** | Every code block in every lesson carries a Hebrew walkthrough, and the course's source files are browsable with syntax highlighting and line-anchored notes. |
| 🤖 **Ask Claude** | One click copies the current section — English, Hebrew and code — as a ready-made prompt to paste into claude.ai. |
| ↔️ **Real RTL** | Hebrew prose right-to-left, code and math left-to-right, bidi-isolated so identifiers never scramble mid-sentence. |

<!-- Want a screenshot here? Drop a PNG at docs/screenshot-home.png and uncomment the next line:
![PPL Expert](docs/screenshot-home.png)
-->

### What a fresh clone actually gives you

**The pipeline does not translate anything.** It builds the English scaffolding and leaves every
Hebrew slot empty. Out of the box, after the two setup commands, you get:

- **41 pages** — 5 chapters of lectures, 12 practice sessions, reading material — across **688 sections**
- **125** course source files, browsable with syntax highlighting
- every section, code block and source file ready to be annotated — and **no Hebrew at all**

Filling those slots *is* the project. For scale: the copy I study from holds **7,454** Hebrew-authored
fields — 1,250 notes on code blocks, 214 exercises, 432 line-anchored annotations across 87 source
files, and a 589-term glossary that keeps the terminology identical across all of it. That took many
long sessions with Claude Code, and it is derived from the course material, which is why it is not
in this repo. See [What is *not* in here](#what-is-not-in-here).

## Setup

Requires **Node 20.11+** and **git**.

```bash
git clone https://github.com/Marzzana/ppl-expert.git
cd ppl-expert
npm install

npm run setup            # clone the course repos into sources/
npm run pipeline:parse   # sources/ -> public/content/*.json

npm run dev              # http://localhost:5199
```

`npm run setup` clones three public repositories into `sources/` (gitignored):

| → `sources/` | repository | what it provides |
|---|---|---|
| `site` | [`bguppl/interpreters`](https://github.com/bguppl/interpreters) (`gh-pages`) | the lesson pages and figures |
| `interpreters` | [`bguppl/interpreters`](https://github.com/bguppl/interpreters) (`master`) | the TypeScript / Scheme interpreter sources |
| `practice` | [`bguppl/practice`](https://github.com/bguppl/practice) | practice-session sources |

After `pipeline:parse` you have **the complete course in English**, fully navigable, with every
Hebrew slot empty — the app works, it just isn't translated yet. Filling those slots is the
translation workflow below. `npm run build` produces a static `dist/` you can host anywhere.

## The pipeline

Sources are never edited, and generated content is never hand-edited. Everything flows one way:

```
sources/  --parse-->  public/content/*.json  --worksheets-->  work/*.md
                              ^                                   |
                              +------------- apply ---------------+
```

| command | what it does |
|---|---|
| `npm run setup` | clone the course repos into `sources/` (idempotent — existing clones are left alone) |
| `npm run pipeline:parse` | `sources/` → `public/content/` JSON. **Idempotent**: re-running preserves existing translations by matching each block on its source hash, so the course can be re-pulled without losing work |
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

## What's in here

```
src/
  pages/       Home (learning path) · Lesson · CodeView · Review
  components/  Sidebar · Markdown · CodeBlock · Exercises · AskClaude
  lib/         content loading · progress store · markdown+KaTeX · shiki · anchors
pipeline/      parse · worksheets · apply · code-worksheets · code-apply · verify · audit
work/          GUIDE.md · GUIDE-CODE.md   (the worksheets themselves are gitignored)
```

Stack: React 18 + TypeScript + Vite, `marked` + KaTeX for rendering, `shiki` for highlighting, and
`HashRouter` so the build can be served as a flat static site. No backend — progress lives in
`localStorage`.

## How this was built with Claude Code

I built this with [Claude Code](https://claude.com/claude-code) across a handful of long sessions —
**247 commits**. I wrote essentially none of the code by hand; my job was deciding what the thing
should be, and catching Claude when it was confidently wrong.

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

## What is *not* in here

| not committed | why |
|---|---|
| `sources/` | the course's own repositories — cloned on demand by `npm run setup` |
| `public/content/` | the generated layer: lesson text, exercises, and **verbatim interpreter source files** from the course repos |
| `public/resources/` | figures from the course site |
| `work/*.md` worksheets | English course text sitting next to its Hebrew translation |
| exams, assignments, solutions | never lived in this repo at all |

The Hebrew translation is derived from the course material and is not mine to redistribute, so it stays
out of the repo along with the English it came from. What is here is the machinery that produces it;
the content itself is generated locally, on your machine, from the course's own public repositories.

If you study PPL at BGU and want a translated copy rather than a toolchain: clone this, run the two
setup commands, and fill the worksheets yourself — `work/GUIDE.md` is the exact brief I gave Claude.

## License

[MIT](LICENSE) — covering **the code in this repository**: the app and the pipeline.

It does not and cannot cover the course material that the pipeline consumes, which belongs to the BGU
PPL course staff and is not distributed here. Nothing in this repo grants any right to that material.
