# Translation Guide — PPL Expert worksheets

You are translating course material for a Hebrew-speaking CS student at BGU studying
"Principles of Programming Languages" (PPL) for an exam. The goal: the student should
understand deeply, in natural Hebrew, without ever losing the English technical vocabulary
they need for the exam and for reading code.

## Workflow

1. Read the worksheet file (`work/<id>.md`). Each `<<<HE id … HE>>>` slot must be filled
   with the Hebrew translation of the EN text right above it. Fill slots using Edit
   (the marker lines `<<<HE cm/…:3:2` are unique anchors).
2. When done, run: `npm run pipeline:apply -- <pageId>` and fix anything it reports.
   Re-run until it prints `COMPLETE`.
3. NEVER edit `public/content/**` directly. NEVER edit the EN text in the worksheet.

## Translation rules

- **Natural, explanatory Hebrew** — not word-by-word. You may slightly rephrase for
  clarity. Do not drop information, examples, or nuance. Do not add your own opinions.
- **Technical terms stay visible in English.** On first use in a page:
  `סְגוֹר (Closure)`. Afterwards use the Hebrew, or the English term if the Hebrew is
  awkward — consistency per the glossary (`public/content/glossary.json`) matters most.
  Terms like `closure`, `thunk`, `currying`, `parsing`, `AST` may stay English inside
  Hebrew sentences.
- **Markdown structure is preserved exactly**: a list stays a list with the same number
  of items, bold stays bold, links keep their URLs (translate only the link text when it
  is prose), tables keep the same columns/rows.
- **Inline code and identifiers**: keep verbatim inside backticks — `` `map` ``,
  `` `x: number` ``. Never translate variable/function names.
- **Math**: keep `$$…$$` / `\(...\)` LaTeX exactly as-is inside the Hebrew sentence.
- **HTML in source** (some pages use `<b>`, `<img>`, `<table>`): keep the same tags in
  the translation, translate only the human text inside them.
- **Hebrew punctuation with English/code endings**: prefer reordering the sentence so it
  does not end with a bare code token when possible; otherwise it's fine — the app
  isolates code spans with CSS bidi rules.

## Code notes (`<<<NOTE id … NOTE>>>` under code blocks)

Write a Hebrew walkthrough that takes NOTHING for granted:
- What the code shows and why it appears at this point of the lesson.
- Line-by-line explanation for non-obvious lines (quote the identifier in backticks).
- The "gotcha" the example demonstrates, if any.
- 2–6 sentences for simple snippets; up to ~12 for dense interpreter code.
- Trivial one-liner outputs (e.g. `5`) may get one short sentence.

## Exercises (`<<<EXERCISES … EXERCISES>>>`)

For **lecture pages**: 4–8 exam-oriented exercises as a JSON array. Target the core
concepts of THIS page — what an exam would ask. Mix:

```json
[
 {"id": "ex1", "type": "mcq", "questionHe": "…שאלה בעברית…",
  "options": ["…", "…", "…", "…"], "correct": 1,
  "explanationHe": "הסבר למה התשובה נכונה ולמה המסיחים שגויים"},
 {"id": "ex2", "type": "code-reading",
  "questionHe": "מה יודפס?\n```typescript\n…code…\n```",
  "answerHe": "…", "explanationHe": "…"},
 {"id": "ex3", "type": "open", "questionHe": "הסבירו את ההבדל בין …",
  "answerHe": "תשובת מודל מלאה", "explanationHe": "נקודות מפתח שחייבות להופיע בתשובה"}
]
```

For **practice pages**: only add items with ids `q1`, `q2`, … (type `open`, with
`answerHe`) for questions that have NO solution in the page itself. Mark clearly:
start `answerHe` with `**תשובת מודל (לא מפתרון הקורס הרשמי):**`.

## Glossary

Add every new term you coined a Hebrew rendering for to the GLOSSARY slot:
`{"closure": "סגור (closure)", "environment": "סביבה (environment)"}`.
Check the existing glossary first and reuse its choices.
