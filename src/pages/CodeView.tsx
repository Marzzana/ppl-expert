import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CodeFile } from "../types/content";
import { loadCodeFile, loadCodeIndex } from "../lib/content";
import { CodeBlock } from "../components/CodeBlock";
import { Markdown } from "../components/Markdown";

/** Code index: all course source files, grouped by folder. */
export function CodeIndex() {
  const [ids, setIds] = useState<string[]>();
  useEffect(() => {
    loadCodeIndex().then(setIds);
  }, []);
  if (!ids) return <div className="page-pad">טוען…</div>;

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const dir = id.split("/").slice(0, -1).join("/");
    groups.set(dir, [...(groups.get(dir) ?? []), id]);
  }

  return (
    <div className="page-pad code-index">
      <h1>קבצי הקוד של הקורס</h1>
      <p>כל קובץ קוד שמקושר מחומרי הקורס, זמין כאן לקריאה עם הדגשת תחביר.</p>
      {[...groups.entries()].map(([dir, files]) => (
        <section key={dir} className="code-group">
          <h2 dir="ltr">{dir}</h2>
          <ul dir="ltr">
            {files.map((id) => (
              <li key={id}>
                <Link to={`/code/${id}`}>{id.split("/").pop()}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Single annotated code file. */
export function CodeView() {
  const params = useParams();
  const id = `${params.repo}/${params["*"]}`;
  const [file, setFile] = useState<CodeFile>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setFile(undefined);
    setError(undefined);
    loadCodeFile(id).then(setFile, (e) => setError(String(e)));
    window.scrollTo(0, 0);
  }, [id]);

  if (error) return <div className="page-pad">שגיאה: {error}</div>;
  if (!file) return <div className="page-pad">טוען…</div>;

  // Split the file at annotation lines so Hebrew notes appear between segments.
  const lines = file.code.split("\n");
  const anns = [...(file.annotations ?? [])].sort((a, b) => a.line - b.line);
  const segments: { code: string; note?: string }[] = [];
  let start = 0;
  for (const a of anns) {
    const cut = Math.max(a.line - 1, start);
    if (cut > start) segments.push({ code: lines.slice(start, cut).join("\n") });
    segments.push({ code: "", note: a.noteHe });
    start = cut;
  }
  segments.push({ code: lines.slice(start).join("\n") });

  return (
    <div className="page-pad code-view">
      <header className="lesson-header">
        <h1 dir="ltr">{file.path}</h1>
        {file.titleHe && <div className="subtitle">{file.titleHe}</div>}
        {file.descriptionHe && <Markdown src={file.descriptionHe} dir="rtl" resourceBase="class_material" />}
        <a href={file.githubUrl} target="_blank" rel="noreferrer" className="btn subtle" dir="ltr">
          GitHub ↗
        </a>
      </header>
      {segments.map((seg, i) =>
        seg.note !== undefined ? (
          <div key={i} className="code-note standalone">
            <Markdown src={seg.note} dir="rtl" resourceBase="class_material" />
          </div>
        ) : (
          seg.code.trim() !== "" && <CodeBlock key={i} code={seg.code} lang={file.lang} />
        ),
      )}
    </div>
  );
}
