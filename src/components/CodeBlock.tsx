import { useEffect, useState } from "react";
import { getHighlighter, normalizeLang } from "../lib/shiki";

/** LTR syntax-highlighted code card. */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [html, setHtml] = useState<string>();
  const l = normalizeLang(lang);

  useEffect(() => {
    let alive = true;
    getHighlighter().then((h) => {
      if (!alive) return;
      setHtml(
        h.codeToHtml(code, {
          lang: h.getLoadedLanguages().includes(l) ? l : "text",
          theme: "github-light",
        }),
      );
    });
    return () => {
      alive = false;
    };
  }, [code, l]);

  if (!html) {
    return (
      <div className="code-card" dir="ltr">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }
  return <div className="code-card" dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Extract the code text out of a fenced markdown block (```lang … ```). */
export function unfence(raw: string): { code: string; lang?: string } {
  const m = raw.trim().match(/^```([^\n]*)\n([\s\S]*?)\n?```$/);
  if (m) return { lang: m[1].trim() || undefined, code: m[2] };
  // indented code block
  return { code: raw.replace(/^ {4}/gm, "").trimEnd() };
}
