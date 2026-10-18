# Guide — Hebrew notes on the course code files

Companion to `work/GUIDE.md` (which covers page translation). This one covers the
**code files** under `public/content/code/`.

## What this task is — and is not

These are **program source files from the course's GitHub repos**, not prose pages.

- **The code is NEVER translated or edited.** `verify.ts` requires `cf.code` to stay
  byte-identical to the repo file. `(define unify …)` stays exactly that. If you think a
  line is wrong, say so in a note — never "fix" it.
- What you write is the **Hebrew layer around** the code:

| field | what it is | rendered as |
|---|---|---|
| `titleHe` | short label for the file | `.subtitle` — **plain text**, no markdown, no `<br/>`, no backticks |
| `descriptionHe` | 2–4 sentences: what the file is, which lesson it belongs to, what to compare it with | markdown, RTL |
| `annotations` | Hebrew walkthrough notes, each anchored to a line | markdown, RTL, rendered **above** that line |

The `annotations` are the same artefact as the 1250 `noteHe` code notes already written on the
lesson pages — the difference is that these cover the **whole file**, not the snippet a lecture
quoted.

## The loop

```bash
npm run pipeline:code-worksheets -- logic        # filter = substring of the code id
# fill work/code__*.md
npm run pipeline:code-apply -- logic
npm run pipeline:verify                          # must stay green
git add -A && git commit -qm "code notes: logic/unify.rkt"
```

Both commands take a **substring filter** (`logic`, `src/L5`, `shared/box.ts`, or a full id).
With no filter they process every annotatable file — 87 of them, so always pass a filter.

`code-apply` is incremental and idempotent: a partly filled worksheet applies fine, and it
reports `PARTIAL … [missing: …]` per file so you can see what is still open. **Apply + commit
after every file** for anything over ~250 lines, and after every 2–3 small ones.

Re-running `pipeline:parse` **preserves** `titleHe` / `descriptionHe` / `annotations`
(`parse.ts:188-190` round-trips them by reading the old JSON). Verified 2026-07-30.

## Worksheet format

The worksheet prints the source **with line numbers** for reference (read-only — editing it
changes nothing) and then takes annotation blocks:

```
<<<NOTE line=42
Hebrew markdown here, single line, however long.
NOTE>>>
```

- `line` is **1-based** and the note renders **above** that line, so anchor a note to the
  first line of the thing it describes.
- Order does not matter; blocks are sorted on apply.
- Out-of-range line numbers are a hard error. Empty blocks are ignored, not an error.
- Two notes on the same line render as two stacked notes.
- `apply` warns if a note contains a literal `\n` — these are **raw markdown**, not JSON, so
  a literal `\n` would show as the two characters `\n`. Only the page `EXERCISES` slot is JSON.

## How many notes, and where

**4–10 structural notes for a 100–300 line file.** Do not annotate every function — the reader
has the code in front of them. Anchor notes at:

- the top of the file (what it is, how it fits the L1→L7 progression);
- each *section* boundary (imports / ADT definitions / the main traversal / helpers / tests);
- every spot the lecture explicitly called out;
- anything genuinely surprising, and every source bug you find (there are many — keep a
  running list of them in your session notes).

A 500+ line file (`LP-ast.rkt`, `monad.ts`, `L7c-eval.ts`) may want 10–15. A 20-line file
wants 1–2.

## Style — same rules as the page notes

- Natural explanatory Hebrew, assume nothing, 2–6 sentences per note (up to ~12 for dense
  interpreter code).
- **Check `public/content/glossary.json` before coining a term** — 589 terms are fixed.
  Reminders: `קופסה` for box (not `תא`), `מפרש` for interpreter (not `אינטרפרטר`),
  `צירוף` for conjunction (not `קוניונקציה`), `תנאי מקדים` for precondition,
  `בדיקת היקרות` for occurs check, `מנתח תחבירי` for parser, `להוט` for eager,
  `הטלה` for projection, and `term` stays English inside Hebrew sentences.
- Identifiers and inline code stay English in backticks. Prefix a bare Latin/`code` token at
  the start of a Hebrew line with a RLM (`‏`) so it does not flip.
- **Cross-reference the lessons** — that is most of the value here. These files are the code
  behind pages the user has already read, so say which lesson a file belongs to and what to
  compare it against (`השוו ל-2.6`, `זה מה ש-5.3 קרא לו apply-rules`).
- Flag things worth memorising: `כדאי לשנן`, `שאלת מבחן קלאסית`, `טעות נפוצה`.

## Reference example

`work/code__interpreters__src__shared__box.ts.md` is filled in and applied — an 8-line file
with `titleHe`, a 2-paragraph `descriptionHe` and 2 notes. Read it before starting, and view
the result at `#/code/interpreters/src/shared/box.ts`.

## Gotchas

- `work/` is **gitignored**. `git status` looks clean while a worksheet is half-filled — only
  `code-apply` moves your text into the committed JSON. Always apply before committing.
- Never edit `public/content/**` by hand.
- Don't import `code-worksheets.ts` from another script: it runs its generator at import time
  and would blank the worksheet you are applying. Shared helpers live in `lib.ts` for exactly
  this reason (this bug was hit and fixed on 2026-07-30).
