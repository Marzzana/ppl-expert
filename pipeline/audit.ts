// Deep content audit of public/content/**. Read-only — never writes.
//
//   npm run pipeline:audit
//
// Complements verify.ts: that one proves nothing was DROPPED from the sources,
// this one checks the Hebrew layer we authored is complete, well-formed and
// consistent with the glossary.
//
// Checks: translated flags, missing he/noteHe/titleHe/descriptionHe, exercise
// schema (mcq option/correct ranges, model-answer prefix on PS pages), annotation
// line ranges and ordering, literal "\n" leaks outside code/math, toc & path
// referential integrity, orphan/case-duplicate code JSONs, and glossary drift.
//
// Rules deliberately NOT enforced, because they produce false positives:
//   • image blocks legitimately have no `he` (no caption text to translate);
//   • `code-reading` answers are program output, so they may contain no Hebrew;
//   • annotations may span multiple lines — they render as markdown;
//   • a "\n" inside a code span is literal source text (e.g. the /;[^\r\n]*/g regex).
import fs from 'fs';
import path from 'path';

const C = path.join(process.cwd(), 'public/content');
const rd = (p: string) => JSON.parse(fs.readFileSync(path.join(C, p), 'utf8'));

const problems: string[] = [];
const info: string[] = [];
const P = (cat: string, msg: string) => problems.push(`[${cat}] ${msg}`);
const I = (cat: string, msg: string) => info.push(`[${cat}] ${msg}`);

// ---------- load ----------
const toc = rd('toc.json');
const pathJson = rd('path.json');
const glossary = rd('glossary.json');
const codeIndex = rd('code-index.json');

const walkAll = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any): string[] =>
  e.isDirectory() ? walkAll(path.join(d, e.name)) : [path.join(d, e.name)]);
const pageFiles = walkAll(path.join(C, 'pages')).filter((f: string) => f.endsWith('.json'));
const pages: any[] = pageFiles.map((f: string) => JSON.parse(fs.readFileSync(f, 'utf8')));
const pageById = new Map<string, any>(pages.map((p: any) => [p.id, p]));

console.log(`loaded: ${pages.length} pages, ${codeIndex.length} code index entries, ${Object.keys(glossary).length} glossary terms`);

// ---------- helpers ----------
// strip fenced code, inline code spans and $$math$$ before scanning Hebrew prose
const stripNoise = (s: string) => s
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`\n]*`/g, ' ')
  .replace(/\$\$[\s\S]*?\$\$/g, ' ')
  .replace(/\$[^$\n]*\$/g, ' ');

const HEB = /[\u0590-\u05FF]/;
// Inline code spans may legitimately contain angle brackets (`Optional<T>`).
const stripCode = (s: string) => s.replace(/`[^`\n]*`/g, ' ');
// Anchor hrefs encode the ORIGINAL heading text, so pre-glossary spellings must
// survive there \u2014 normalising them would break the link. Only visible text counts.
const stripLinkTargets = (s: string) => s.replace(/\]\([^)]*\)/g, '](\u2026)');

// ================= 1. pages =================
for (const p of pages) {
  if (!p.translated) P('page', `${p.id} translated=false`);
  if (!p.titleHe || !p.titleHe.trim()) P('page', `${p.id} missing titleHe`);
  if (p.titleHe && /<[a-z/][^>]*>/i.test(stripCode(p.titleHe))) P('page', `${p.id} titleHe contains HTML: ${p.titleHe.slice(0,60)}`);

  const blockIds = new Set(), secIds = new Set();
  for (const s of p.sections) {
    if (secIds.has(s.id)) P('page', `${p.id} duplicate section id ${s.id}`);
    secIds.add(s.id);
    if (s.depth > 0 && (!s.headingHe || !s.headingHe.trim())) P('page', `${p.id} section ${s.id} missing headingHe`);
    if (s.headingHe && /<[a-z/][^>]*>/i.test(stripCode(s.headingHe))) P('page', `${p.id} headingHe has HTML: ${s.id} ${s.headingHe.slice(0,50)}`);
    for (const b of s.blocks) {
      if (blockIds.has(b.id)) P('page', `${p.id} duplicate block id ${b.id}`);
      blockIds.add(b.id);
      if (b.type === 'code') {
        if (!b.noteHe || !b.noteHe.trim()) P('note', `${p.id} code block ${b.id} has no noteHe`);
        if (b.he) P('note', `${p.id} code block ${b.id} unexpectedly has he`);
      } else if (b.type !== 'hr' && b.type !== 'image') {
        // image blocks carry no translatable text of their own
        if (!b.he || !b.he.trim()) P('page', `${p.id} block ${b.id} (${b.type}) missing he`);
      }
      // literal \n leaks in Hebrew markdown (outside code/math)
      for (const [f, v] of [['he', b.he], ['noteHe', b.noteHe]]) {
        if (v && stripNoise(v).includes('\\n')) P('escape', `${p.id} ${b.id} ${f} literal \\n outside code/math`);
      }
      // A markdown heading inside an open raw-HTML block never becomes a heading —
      // it renders as the literal text "### ...". This has bitten ps11 twice.
      if (b.he) {
        let open = 0;
        for (const line of b.he.split('\n')) {
          if (/^#{1,6} /.test(line) && open > 0)
            P('render', `${p.id} ${b.id} markdown heading inside a raw HTML block: ${line.slice(0, 45)}`);
          open = Math.max(0, open + (line.match(/<div\b/g) ?? []).length - (line.match(/<\/div>/g) ?? []).length);
        }
        // GitHub retired its math-rendering proxy; those images are permanently broken.
        for (const u of b.he.match(/https?:\/\/render\.githubusercontent\.com\/render\/math[^)\s"']*/g) ?? [])
          P('render', `${p.id} ${b.id} dead math-proxy image: ${u.slice(0, 60)}`);
      }
      // structure preservation: bold/link counts
      if (b.he && b.type === 'prose') {
        const cnt = (s: string) => (s.match(/\]\(/g) || []).length;
        if (cnt(b.en) !== cnt(b.he)) I('links', `${p.id} ${b.id} link count en=${cnt(b.en)} he=${cnt(b.he)}`);
      }
    }
  }

  // exercises
  const exIds = new Set();
  for (const e of (p.exercises || [])) {
    if (exIds.has(e.id)) P('exercise', `${p.id} duplicate exercise id ${e.id}`);
    exIds.add(e.id);
    if (!e.questionHe || !e.questionHe.trim()) P('exercise', `${p.id} ${e.id} empty questionHe`);
    if (e.type === 'mcq') {
      if (!Array.isArray(e.options) || e.options.length < 2) P('exercise', `${p.id} ${e.id} mcq with ${e.options?.length} options`);
      if (typeof e.correct !== 'number') P('exercise', `${p.id} ${e.id} mcq missing correct`);
      else if (e.correct < 0 || e.correct >= (e.options?.length ?? 0)) P('exercise', `${p.id} ${e.id} correct=${e.correct} out of range (${e.options?.length} options)`);
      if ((e.options||[]).some((o: string) => !o || !o.trim())) P('exercise', `${p.id} ${e.id} has an empty option`);
      if (new Set(e.options||[]).size !== (e.options||[]).length) P('exercise', `${p.id} ${e.id} duplicate option text`);
      if (!e.explanationHe) I('exercise', `${p.id} ${e.id} mcq without explanationHe`);
    } else {
      if (!e.answerHe || !e.answerHe.trim()) P('exercise', `${p.id} ${e.id} ${e.type} missing answerHe`);
      if (e.correct !== undefined || e.options !== undefined) I('exercise', `${p.id} ${e.id} non-mcq carries options/correct`);
    }
    // questionHe must be Hebrew; answers may be pure program output (code-reading).
    if (e.questionHe && !HEB.test(e.questionHe)) P('exercise', `${p.id} ${e.id} questionHe has no Hebrew`);
    // practice pages: model answer prefix convention
    if (p.kind === 'practice' && /^q\d+$/.test(e.id) && e.answerHe && !e.answerHe.startsWith('**תשובת מודל (לא מפתרון הקורס הרשמי):**')) {
      P('exercise', `${p.id} ${e.id} practice answer missing the model-answer prefix`);
    }
  }
}

// ================= 2. code files =================
const isAnnotatable = (id: string) => !/\.test\.ts$|-tests?\.rkt$|^interpreters\/test\/|\.md$/.test(id) && !id.startsWith('practice/');
let totalAnn = 0, annotatedFiles = 0;
for (const id of codeIndex as string[]) {
  const f = path.join(C, 'code', ...id.split('/')) + '.json';
  if (!fs.existsSync(f)) { P('code', `${id} in index but no JSON on disk`); continue; }
  const cf = JSON.parse(fs.readFileSync(f, 'utf8'));
  const lines = cf.code.split('\n').length;
  if (!isAnnotatable(id)) {
    if (cf.annotations?.length) I('code', `${id} is non-annotatable but has ${cf.annotations.length} annotations`);
    continue;
  }
  if (!cf.titleHe || !cf.titleHe.trim()) P('code', `${id} missing titleHe`);
  if (cf.titleHe && /[`<]/.test(cf.titleHe)) P('code', `${id} titleHe contains markup: ${cf.titleHe}`);
  if (!cf.descriptionHe || !cf.descriptionHe.trim()) P('code', `${id} missing descriptionHe`);
  if (!cf.annotations || !cf.annotations.length) { P('code', `${id} has no annotations`); continue; }
  annotatedFiles++; totalAnn += cf.annotations.length;

  const seen = new Map();
  let prev = -Infinity;
  for (const a of cf.annotations) {
    if (typeof a.line !== 'number' || !Number.isInteger(a.line)) P('code', `${id} non-integer line ${a.line}`);
    if (a.line < 1 || a.line > lines) P('code', `${id} annotation line ${a.line} out of range (file has ${lines})`);
    if (a.line < prev) P('code', `${id} annotations not sorted (${a.line} after ${prev})`);
    prev = a.line;
    if (!a.noteHe || !a.noteHe.trim()) P('code', `${id} empty noteHe at line ${a.line}`);
    if (a.noteHe && !HEB.test(a.noteHe)) P('code', `${id} noteHe at line ${a.line} has no Hebrew`);
    if (a.noteHe && stripNoise(a.noteHe).includes('\\n')) P('escape', `${id} line ${a.line} literal \\n outside code/math`);
    seen.set(a.line, (seen.get(a.line) || 0) + 1);
  }
  for (const [l, n] of seen) if (n > 1) I('code', `${id} ${n} annotations on line ${l}`);

  // github url sanity
  if (!cf.githubUrl || !/^https:\/\/github\.com\//.test(cf.githubUrl)) P('code', `${id} bad githubUrl: ${cf.githubUrl}`);
  else {
    const tail = cf.githubUrl.split('/blob/master/')[1];
    if (tail && !id.endsWith(tail)) I('code', `${id} githubUrl tail mismatch: ${tail}`);
  }
}
console.log(`annotated: ${annotatedFiles} files, ${totalAnn} annotations`);

// orphan JSONs under content/code
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any): string[] =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const onDisk = walk(path.join(C, 'code')).map((f: string) =>
  path.relative(path.join(C, 'code'), f).replace(/\\/g, '/').replace(/\.json$/, ''));
const idxSet = new Set<string>(codeIndex as string[]);
for (const f of onDisk) if (!idxSet.has(f)) P('code', `orphan JSON not in index: ${f}`);
// case-duplicate detection
const lower = new Map<string, string>();
for (const f of onDisk) {
  const k = f.toLowerCase();
  if (lower.has(k) && lower.get(k) !== f) P('code', `case-duplicate: ${lower.get(k)} vs ${f}`);
  lower.set(k, f);
}

// ================= 3. toc / path =================
const tocIds: string[] = [
  ...toc.classMaterial.flatMap((c: any) => c.entries.map((e: any) => e.pageId)),
  ...toc.practiceSessions.map((e: any) => e.pageId),
];
for (const id of tocIds) if (!pageById.has(id)) P('toc', `toc references missing page ${id}`);
for (const p of pages) if (!tocIds.includes(p.id)) I('toc', `page not in toc: ${p.id}`);
const dupToc = tocIds.filter((x: string, i: number) => tocIds.indexOf(x) !== i);
if (dupToc.length) P('toc', `duplicate toc entries: ${[...new Set(dupToc)].join(', ')}`);
// toc entry/chapter titleHe is dead schema: Sidebar.tsx renders page.titleHe instead.
// Reported as info so it is not mistaken for missing translation work.
{
  const missing = [...toc.classMaterial.flatMap((c: any) => c.entries), ...toc.practiceSessions].filter((e: any) => !e.titleHe).length;
  if (missing) I('toc', `${missing} toc entries have no titleHe — unused field, Sidebar reads page.titleHe`);
}
for (const e of [...toc.classMaterial.flatMap((c: any)=>c.entries), ...toc.practiceSessions] as any[])
  if (e.titleHe && /<[a-z/][^>]*>/i.test(e.titleHe)) P('toc', `toc titleHe has HTML: ${e.pageId} — ${e.titleHe.slice(0,50)}`);

const pathIds: string[] = pathJson.items.map((i: any) => i.pageId);
for (const id of pathIds) if (!pageById.has(id)) P('path', `path references missing page ${id}`);
const dupPath = pathIds.filter((x: string, i: number) => pathIds.indexOf(x) !== i);
if (dupPath.length) P('path', `duplicate path entries: ${[...new Set(dupPath)].join(', ')}`);
// useful_links is a reference page, not a study step — Sidebar links to it directly.
for (const p of pages) if (!pathIds.includes(p.id) && p.id !== 'links/useful_links')
  P('path', `page missing from learning path: ${p.id}`);
// toc.codeGroups holds full GitHub URLs and is currently read by nothing in src/.
// Still worth checking each URL resolves to a file we actually have.
{
  const unresolved = toc.codeGroups.flatMap((g: any) => g.files).filter((u: string) => {
    const tail = u.split('/blob/master/')[1];
    return !tail || ![...idxSet].some((id: string) => id.endsWith(tail));
  });
  if (unresolved.length) I('toc', `${unresolved.length} codeGroup URLs resolve to no local file (e.g. ${unresolved[0]?.slice(-40)})`);
}

// ================= 4. glossary drift =================
const BAD = {
  'פרסר': 'מנתח תחבירי', 'פירסור': 'ניתוח תחבירי', 'בשקיקה': 'להוט',
  'תנאי מוקדם': 'תנאי מקדים', 'בדיקת מעגליות': 'בדיקת היקרות',
  'יוניפיקציה': 'אוניפיקציה', 'פנקטור': 'פונקטור', 'פרולוג': 'Prolog',
  'אינטרפרטר': 'מפרש', 'היטל': 'הטלה', 'קוניונקציה': 'צירוף',
};
let scanned = 0;
const scanField = (where: string, field: string, text?: string) => {
  if (!text) return;
  scanned++;
  const visible = stripLinkTargets(text);
  for (const [bad, good] of Object.entries(BAD)) {
    if (visible.includes(bad)) P('glossary', `${where} ${field}: "${bad}" should be "${good}"`);
  }
};
for (const p of pages) {
  scanField(p.id, 'titleHe', p.titleHe);
  for (const s of p.sections) {
    scanField(p.id, `${s.id} headingHe`, s.headingHe);
    for (const b of s.blocks) { scanField(p.id, `${b.id} he`, b.he); scanField(p.id, `${b.id} noteHe`, b.noteHe); }
  }
  for (const e of (p.exercises || [])) {
    scanField(p.id, `${e.id} questionHe`, e.questionHe);
    scanField(p.id, `${e.id} answerHe`, e.answerHe);
    scanField(p.id, `${e.id} explanationHe`, e.explanationHe);
    for (const o of (e.options || [])) scanField(p.id, `${e.id} option`, o);
  }
}
for (const id of codeIndex as string[]) {
  const f = path.join(C, 'code', ...id.split('/')) + '.json';
  if (!fs.existsSync(f)) continue;
  const cf = JSON.parse(fs.readFileSync(f, 'utf8'));
  scanField(id, 'titleHe', cf.titleHe);
  scanField(id, 'descriptionHe', cf.descriptionHe);
  for (const a of (cf.annotations || [])) scanField(id, `line ${a.line}`, a.noteHe);
}
console.log(`glossary sweep: ${scanned} Hebrew-authored fields scanned`);

// glossary file itself
const gKeys = Object.keys(glossary);
const gLower = new Map<string, string>();
for (const k of gKeys) {
  const l = k.toLowerCase();
  if (gLower.has(l)) P('glossary', `case-duplicate key: "${gLower.get(l)}" vs "${k}"`);
  gLower.set(l, k);
  if (!glossary[k] || !glossary[k].trim()) P('glossary', `empty value for "${k}"`);
  else if (!HEB.test(glossary[k]) && !/^[A-Za-z]/.test(glossary[k])) P('glossary', `value not Hebrew: "${k}" -> "${glossary[k]}"`);
}

// ================= report =================
console.log('\n================ PROBLEMS (' + problems.length + ') ================');
const byCat: Record<string, string[]> = {};
for (const p of problems) { const c = p.match(/^\[(\w+)\]/)![1]; (byCat[c] ||= []).push(p); }
for (const [c, list] of Object.entries(byCat)) {
  console.log(`\n--- ${c} (${list.length}) ---`);
  for (const l of list.slice(0, 25)) console.log('  ' + l);
  if (list.length > 25) console.log(`  … and ${list.length - 25} more`);
}
console.log('\n================ INFO (' + info.length + ') ================');
const iCat: Record<string, string[]> = {};
for (const p of info) { const c = p.match(/^\[(\w+)\]/)![1]; (iCat[c] ||= []).push(p); }
for (const [c, list] of Object.entries(iCat)) {
  console.log(`\n--- ${c} (${list.length}) ---`);
  for (const l of list.slice(0, 12)) console.log('  ' + l);
  if (list.length > 12) console.log(`  … and ${list.length - 12} more`);
}
