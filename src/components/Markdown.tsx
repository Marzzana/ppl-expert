import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { renderMarkdown } from "../lib/markdown";
import { findAnchorTarget } from "../lib/anchors";

/**
 * Rendered markdown container. dir controls bidi context:
 * Hebrew content → rtl, English original → ltr.
 * Internal <a href="/..."> links are routed through react-router.
 */
export function Markdown({ src, dir, resourceBase }: { src: string; dir: "rtl" | "ltr"; resourceBase: string }) {
  const navigate = useNavigate();
  const html = useMemo(() => renderMarkdown(src, resourceBase), [src, resourceBase]);
  return (
    <div
      className="prose"
      dir={dir}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        const href = a?.getAttribute("href");
        if (!href) return;
        if (href.startsWith("/")) {
          e.preventDefault();
          navigate(href);
        } else if (href.startsWith("#/")) {
          // HashRouter route link ("#/page/..."), not an in-page anchor.
          e.preventDefault();
          navigate(href.slice(1));
        } else if (href.startsWith("#")) {
          // In-page anchor (ps11/ps12 ship their own table of contents). Under a
          // HashRouter an un-intercepted "#..." click is read as a route change and
          // blanks the page, so always swallow it and scroll instead.
          e.preventDefault();
          // Instant, not smooth: smooth scrolling is a no-op in some environments,
          // and "the link does nothing" is the exact failure this code exists to fix.
          findAnchorTarget(href)?.scrollIntoView({ block: "start" });
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
