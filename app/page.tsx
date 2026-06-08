"use client";

import { useState } from "react";
import ReviewPanel from "./components/review-panel";
import ExtractPanel from "./components/extract-panel";

type Mode = "review" | "extract";

// Two faces of the same idea: a cheap model put in front of an expensive one to
// keep it honest. The Reviewer gates AI output against a checklist; the Extractor
// pulls structured data and flags what it can't be sure of instead of inventing it.
export default function Home() {
  const [mode, setMode] = useState<Mode>("review");

  return (
    <main className="page">
      <nav className="modes" aria-label="Mode">
        <button
          className={mode === "review" ? "on" : ""}
          onClick={() => setMode("review")}
          type="button"
        >
          Review
        </button>
        <button
          className={mode === "extract" ? "on" : ""}
          onClick={() => setMode("extract")}
          type="button"
        >
          Extract
        </button>
      </nav>

      {mode === "review" ? <ReviewPanel /> : <ExtractPanel />}

      <footer className="foot">
        Two cheap-model QA patterns in one tool: gate an AI&apos;s output against a checklist, or
        pull structured data that flags what it isn&apos;t sure of instead of guessing. Open source.
        Built by{" "}
        <a href="https://henningsandtorv.dev" target="_blank" rel="noopener">
          Henning Sandtorv
        </a>
        . Bring your own key, or set a server key.
      </footer>
    </main>
  );
}
