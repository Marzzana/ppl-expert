import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/heebo/700.css";
import "katex/dist/katex.min.css";
import "./styles.css";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./pages/Home";
import { Lesson } from "./pages/Lesson";
import { CodeIndex, CodeView } from "./pages/CodeView";
import { Review } from "./pages/Review";

/** Any unrecognised URL — without this the main area renders empty with no explanation. */
function NotFound() {
  return (
    <div className="page-pad">
      <h1>הדף לא נמצא</h1>
      <p>הכתובת שהוקלדה אינה קיימת. אפשר לבחור דף מהתפריט, או לחזור לדף הבית.</p>
      <Link to="/" className="btn primary">
        לדף הבית
      </Link>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/page/:group/*" element={<Lesson />} />
            <Route path="/code" element={<CodeIndex />} />
            <Route path="/code/:repo/*" element={<CodeView />} />
            <Route path="/review" element={<Review />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
