// Merge work/glossary/*.json sidecars into public/content/glossary.json.
// Run after a translation batch completes (single-writer, so no races).

import * as fs from "node:fs";
import * as path from "node:path";
import { ROOT, CONTENT, readJson, writeJson } from "./lib";

const dir = path.join(ROOT, "work", "glossary");
const glPath = path.join(CONTENT, "glossary.json");
const glossary = readJson<Record<string, string>>(glPath) ?? {};
let added = 0;

if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).sort()) {
    const side = readJson<Record<string, string>>(path.join(dir, f)) ?? {};
    for (const [term, he] of Object.entries(side)) {
      const key = term.toLowerCase();
      if (!(key in glossary)) {
        glossary[key] = he;
        added++;
      }
    }
  }
}

writeJson(glPath, Object.fromEntries(Object.entries(glossary).sort(([a], [b]) => a.localeCompare(b))));
console.log(`glossary: ${Object.keys(glossary).length} terms (${added} added)`);
