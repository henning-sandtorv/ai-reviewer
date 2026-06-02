"use client";

import { useState } from "react";
import { EXAMPLES } from "../lib/examples";
import type { ReviewResult } from "../lib/schema";

const MARK = { pass: "✓", fail: "✕", unsure: "?" } as const;

export default function Home() {
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [checklist, setChecklist] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  function loadExample(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setSource(ex.source);
    setOutput(ex.output);
    setChecklist(ex.checklist.join("\n"));
    setError(null);
    setResult(null);
  }

  async function runReview() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source,
          output,
          checklist: checklist.split("\n").map((l) => l.trim()).filter(Boolean),
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data as ReviewResult);
      }
    } catch {
      setError("Could not reach the reviewer. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const canRun = output.trim().length > 0 && checklist.trim().length > 0 && !loading;

  return (
    <main className="page">
      <header className="head">
        <p className="eyebrow">The Reviewer</p>
        <h1>AI that catches AI&apos;s mistakes.</h1>
        <p className="lead">
          A second, cheaper model reads what the first AI produced, checks it
          against your checklist, and <b>blocks it when something is wrong</b> —
          showing you exactly what it caught and why. The verdict is per item; the
          block is decided in code, not by vibes.
        </p>

        <div className="examples">
          <span className="label">Try one:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.id} className="chip" onClick={() => loadExample(ex.id)}>
              {ex.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid">
        {/* ---- inputs ---- */}
        <section className="panel" aria-label="Input">
          <h2>What to check</h2>

          <div className="field">
            <label htmlFor="source">
              Source <span className="hint">ground truth — optional</span>
            </label>
            <textarea
              id="source"
              className="short"
              placeholder="Paste the source the output should be faithful to. Without it, the reviewer can still judge tone and consistency, but cannot catch a made-up fact."
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="output">
              AI output <span className="hint">what to review</span>
            </label>
            <textarea
              id="output"
              className="tall"
              placeholder="Paste the AI-generated text you want reviewed."
              value={output}
              onChange={(e) => setOutput(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="checklist">
              Checklist <span className="hint">one rule per line</span>
            </label>
            <textarea
              id="checklist"
              className="short"
              placeholder={"Every fact is supported by the source.\nNo numbers are invented or changed.\nThe tone is professional."}
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="key">
              Anthropic API key <span className="hint">used for this request only, never stored</span>
            </label>
            <input
              id="key"
              type="password"
              placeholder="sk-ant-…  (leave blank if the server already has one)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="run">
            <button onClick={runReview} disabled={!canRun}>
              {loading ? "Reviewing…" : "Run review"}
            </button>
            <span className="note">A small model (Haiku) does the reviewing.</span>
          </div>
        </section>

        {/* ---- result ---- */}
        <section className="panel" aria-label="Result" aria-live="polite">
          <h2>Verdict</h2>

          {!result && !error && (
            <p className="result-empty">
              Load an example or paste your own, then run the review. The reviewer
              grades each checklist item and blocks the output if any item fails.
            </p>
          )}

          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className={`gate ${result.decision}`}>
                <span className="badge">
                  {result.decision === "block" ? "BLOCKED" : "PASSED"}
                </span>
                <span className="summary">{result.summary}</span>
              </div>

              <div className="items">
                {result.items.map((it, i) => (
                  <div key={i} className={`item ${it.verdict}`}>
                    <div className="mark">{MARK[it.verdict]}</div>
                    <div>
                      <div className="crit">{it.criterion}</div>
                      <div className="ev">{it.evidence}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="meta">
                <span>
                  {result.counts.pass} pass · {result.counts.fail} fail ·{" "}
                  {result.counts.unsure} unsure
                </span>
                <span>{result.model}</span>
                <span>{result.ms} ms</span>
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="foot">
        The reviewer pattern: don&apos;t trust one model&apos;s output blindly —
        put a second, cheaper one in front of it as a gate. Open source. Built by{" "}
        <a href="https://henningsandtorv.dev" target="_blank" rel="noopener">
          Henning Sandtorv
        </a>
        . Bring your own key, or set <code>ANTHROPIC_API_KEY</code> on the server.
      </footer>
    </main>
  );
}
