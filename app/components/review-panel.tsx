"use client";

import { useEffect, useState } from "react";
import { EXAMPLES } from "../../lib/examples";
import type { ReviewResult } from "../../lib/schema";
import type { ProviderId } from "../../lib/provider";
import ProviderConfig from "./provider-config";

const MARK = { pass: "✓", fail: "✕", unsure: "?" } as const;
const LESSONS_KEY = "ai-reviewer:lessons";

// A recorded review so anyone can watch the gate catch a hallucination with no key.
// It pairs with the "Summary with invented facts" example (60-day window, made-up fee).
const REVIEW_DEMO: ReviewResult = {
  decision: "block",
  items: [
    { criterion: "Every fact in the summary is supported by the source.", verdict: "fail", evidence: "The summary says returns are allowed within 60 days; the source says 30." },
    { criterion: "No numbers (days, fees, percentages) are changed or invented.", verdict: "fail", evidence: "30 days became 60, and a 10% restocking fee was added." },
    { criterion: "The summary does not add any policy that is not in the source.", verdict: "fail", evidence: "The 10% restocking fee appears nowhere in the source." },
    { criterion: "The tone is clear and professional.", verdict: "pass", evidence: "Reads clearly and professionally." },
  ],
  summary: "Blocked: the summary doubles the refund window and invents a restocking fee.",
  counts: { pass: 1, fail: 3, unsure: 0 },
  model: "claude-haiku-4-5 (recorded)",
  provider: "anthropic",
  ms: 1120,
};

export default function ReviewPanel() {
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [checklist, setChecklist] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  // The learning loop: corrections accumulate as lessons and ride along on every
  // future review. Stored in the browser so they survive reloads without a server.
  const [lessons, setLessons] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LESSONS_KEY);
      if (saved) setLessons(JSON.parse(saved));
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  function saveLessons(next: string[]) {
    setLessons(next);
    try {
      localStorage.setItem(LESSONS_KEY, JSON.stringify(next));
    } catch {
      /* ignore unwritable storage */
    }
  }

  function addLesson(text: string) {
    const t = text.trim();
    if (!t || lessons.includes(t)) return;
    saveLessons([...lessons, t]);
  }

  function removeLesson(i: number) {
    saveLessons(lessons.filter((_, idx) => idx !== i));
  }

  function loadExample(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setSource(ex.source);
    setOutput(ex.output);
    setChecklist(ex.checklist.join("\n"));
    setError(null);
    setResult(null);
    setCorrecting(null);
  }

  // Load the hallucination example and show its recorded verdict, no key needed.
  function playDemo() {
    loadExample("refund-hallucination");
    setResult(REVIEW_DEMO);
  }

  async function runReview() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCorrecting(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          source,
          output,
          checklist: checklist.split("\n").map((l) => l.trim()).filter(Boolean),
          lessons,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong.");
      else setResult(data as ReviewResult);
    } catch {
      setError("Could not reach the reviewer. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function openCorrection(i: number) {
    setCorrecting(i === correcting ? null : i);
    setDraft("");
  }

  function saveCorrection() {
    addLesson(draft);
    setCorrecting(null);
    setDraft("");
  }

  const canRun = output.trim().length > 0 && checklist.trim().length > 0 && !loading;

  return (
    <>
      <header className="head">
        <p className="eyebrow">The Reviewer</p>
        <h1>AI that catches AI&apos;s mistakes.</h1>
        <p className="lead">
          A second, cheaper model reads what the first AI produced, checks it against your
          checklist, and <b>blocks it when something is wrong</b> — showing exactly what it
          caught. The verdict is per item; the block is decided in code, not by vibes. Works
          with any model, and <b>learns from the mistakes you correct</b>.
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

          <ProviderConfig
            roleLabel="Reviewer"
            roleHint="which model does the checking"
            provider={provider}
            setProvider={setProvider}
            model={model}
            setModel={setModel}
            baseUrl={baseUrl}
            setBaseUrl={setBaseUrl}
            apiKey={apiKey}
            setApiKey={setApiKey}
          />

          <div className="run">
            <button onClick={runReview} disabled={!canRun}>
              {loading ? "Reviewing…" : "Run review"}
            </button>
            <button className="ghost" onClick={playDemo} disabled={loading} type="button">
              Play demo (no key)
            </button>
            <span className="note">
              Use a small, cheap model — the point is that it still catches the big one&apos;s
              mistakes.
            </span>
          </div>
        </section>

        {/* ---- result ---- */}
        <section className="panel" aria-label="Result" aria-live="polite">
          <h2>Verdict</h2>

          {!result && !error && (
            <p className="result-empty">
              Load an example or paste your own, then run the review. The reviewer grades each
              checklist item and blocks the output if any item fails. Disagree with a verdict?
              Teach it — your correction is applied to every review after.
            </p>
          )}

          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className={`gate ${result.decision}`}>
                <span className="badge">{result.decision === "block" ? "BLOCKED" : "PASSED"}</span>
                <span className="summary">{result.summary}</span>
              </div>

              <div className="items">
                {result.items.map((it, i) => (
                  <div key={i} className={`item ${it.verdict}`}>
                    <div className="mark">{MARK[it.verdict]}</div>
                    <div>
                      <div className="crit">{it.criterion}</div>
                      <div className="ev">{it.evidence}</div>
                      <button className="teach-toggle" onClick={() => openCorrection(i)}>
                        {correcting === i ? "Cancel" : "This verdict is wrong →"}
                      </button>
                      {correcting === i && (
                        <div className="teach">
                          <textarea
                            placeholder={'Write the rule it should follow next time, e.g. "If the source says ‘up to 30 days’, an output that says ‘30 days’ is fine — don’t flag it."'}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <button
                            className="teach-save"
                            onClick={saveCorrection}
                            disabled={!draft.trim()}
                          >
                            Save lesson
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="meta">
                <span>
                  {result.counts.pass} pass · {result.counts.fail} fail · {result.counts.unsure} unsure
                </span>
                <span>
                  {result.provider} · {result.model}
                </span>
                <span>{result.ms} ms</span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ---- learned lessons ---- */}
      <section className="panel lessons" aria-label="Learned lessons">
        <div className="lessons-head">
          <h2>What it has learned</h2>
          <span className="count">
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
          </span>
        </div>
        {lessons.length === 0 ? (
          <p className="result-empty">
            Nothing yet. When you mark a verdict wrong and save the rule, it shows up here and is
            sent with every future review so the reviewer applies it. Stored in your browser only.
          </p>
        ) : (
          <ul className="lesson-list">
            {lessons.map((l, i) => (
              <li key={i}>
                <span>{l}</span>
                <button onClick={() => removeLesson(i)} aria-label="Forget this lesson">
                  forget
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
