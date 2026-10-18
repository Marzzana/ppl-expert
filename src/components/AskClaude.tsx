import { useState } from "react";
import type { Page, Section } from "../types/content";
import { mdToText } from "../lib/markdown";

function buildPrompt(page: Page, section?: Section): string {
  const parts: string[] = [
    "אני סטודנט שלומד את הקורס Principles of Programming Languages (PPL) באוניברסיטת בן-גוריון, לקראת מבחן.",
    "אני לומד כרגע את הדף הבא מתוך אתר הקורס (bguppl.github.io/interpreters).",
    "ענה לי בעברית, אבל השאר מונחים טכניים ושמות באנגלית, וקוד באנגלית כמובן.",
    "",
    `## הדף: ${page.titleHe ?? page.titleEn}`,
  ];
  const sections = section ? [section] : page.sections;
  for (const s of sections) {
    if (s.headingEn) parts.push("", `### ${s.headingEn}`);
    for (const b of s.blocks) {
      parts.push("", b.en.trim());
      if (b.he && b.type !== "code") parts.push("", `(התרגום שלנו: ${mdToText(b.he)})`);
    }
  }
  parts.push("", "---", "השאלה שלי: ");
  return parts.join("\n");
}

/** Copies a fully-formatted context prompt for claude.ai to the clipboard. */
export function AskClaude({ page, section }: { page: Page; section?: Section }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ask-claude"
      title="מעתיק את התוכן של הקטע כהקשר לשאלה ב-claude.ai"
      onClick={async () => {
        await navigator.clipboard.writeText(buildPrompt(page, section));
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? "הועתק! הדביקו ב-claude.ai" : "🤖 שאלה על הקטע"}
    </button>
  );
}
