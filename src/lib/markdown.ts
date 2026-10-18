// Markdown → HTML for content blocks: KaTeX math, image path rewriting,
// internal-link rewriting to app routes, external links in new tabs.
// Bidi safety: rendering happens inside dir-controlled containers; inline
// code gets `unicode-bidi: isolate` via CSS.

import { marked } from "marked";
import katex from "katex";

interface Seg {
  placeholder: string;
  html: string; // "" → restore verbatim protected inline-code text
  code?: string;
}

/** Replace $$…$$, \(…\), \[…\] with placeholders; render with KaTeX. Inline code spans win over math. */
function extractMath(src: string): { text: string; segs: Seg[] } {
  const segs: Seg[] = [];
  let i = 0;
  const sub = (tex: string, display: boolean) => {
    const placeholder = `MATH${i++}`;
    let html: string;
    try {
      html = katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, output: "html" });
    } catch {
      html = `<code>${tex}</code>`;
    }
    segs.push({ placeholder, html });
    return placeholder;
  };
  const text = src
    .replace(/`[^`\n]+`/g, (m) => {
      const placeholder = `CODE${i++}`;
      segs.push({ placeholder, html: "", code: m });
      return placeholder;
    })
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => sub(tex, tex.includes("\n")))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => sub(tex, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex: string) => sub(tex, false));
  return { text, segs };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Rewrite an original-site href to an app route, or undefined if external. */
function internalRoute(href: string): string | undefined {
  let m = href.match(/(?:^|\/)class_material\/([^/#?]+)\.(?:html|md)/);
  if (m) return `/page/cm/${m[1]}`;
  m = href.match(/practice_sessions\/reading_material\/([^/#?]+)\.(?:html|md)/);
  if (m) return `/page/reading/${m[1]}`;
  m = href.match(/(?:^|\/)practice_sessions\/([^/#?]+)\.(?:html|md)/);
  if (m) return `/page/ps/${m[1]}`;
  m = href.match(/^https:\/\/github\.com\/bguppl\/(interpreters|practice)\/(?:blob|tree)\/[^/]+\/(.+?)(?:#.*)?$/);
  if (m) return `/code/${m[1]}/${m[2]}`;
  if (href === "https://github.com/bguppl/practice" || href === "https://github.com/bguppl/practice/") return "/code";
  return undefined;
}

function postProcess(html: string, resourceBase: string): string {
  // images: relative refs → /resources/<group>/…
  html = html.replace(/(<img[^>]*\ssrc=")([^"]+)(")/g, (_, pre: string, src: string, post: string) => {
    if (/^https?:|^\//.test(src)) return pre + src + post;
    const clean = decodeURIComponent(src).replace(/^\.\//, "").replace(/^(\.\.\/)+/, "").replace(/^resources\//, "");
    return pre + encodeURI(`/resources/${resourceBase}/${clean}`) + post;
  });
  // links: internal → app route; external → new tab
  html = html.replace(/<a\s+href="([^"]+)"/g, (m0, href: string) => {
    const route = internalRoute(href);
    if (route) return `<a href="${route}"`;
    if (/^https?:/.test(href)) return `<a target="_blank" rel="noreferrer" href="${href}"`;
    return m0;
  });
  return html;
}

/**
 * Render a markdown block to HTML.
 * resourceBase: 'class_material' | 'practice_sessions' — for relative image refs.
 */
export function renderMarkdown(src: string, resourceBase: string): string {
  const { text, segs } = extractMath(src);
  let html = marked.parse(text, { async: false, gfm: true }) as string;
  for (const s of segs) {
    const replacement = s.html !== "" ? s.html : `<code>${escapeHtml(s.code!.slice(1, -1))}</code>`;
    html = html.replaceAll(s.placeholder, replacement);
  }
  return postProcess(html, resourceBase);
}

/** Strip markdown to plain-ish text (for prompts/labels). */
export function mdToText(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .trim();
}
