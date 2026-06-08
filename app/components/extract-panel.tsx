"use client";

import { useState } from "react";
import { EXTRACT_EXAMPLES } from "../../lib/extract-examples";
import type { ExtractResult, FieldStatus } from "../../lib/extract-schema";
import type { ProviderId } from "../../lib/provider";
import ProviderConfig from "./provider-config";

const MARK: Record<FieldStatus, string> = { found: "✓", uncertain: "?", missing: "—" };
const STATUS_LABEL: Record<FieldStatus, string> = {
  found: "found",
  uncertain: "uncertain",
  missing: "missing",
};

export default function ExtractPanel() {
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [docText, setDocText] = useState("");
  const [fields, setFields] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  function loadExample(id: string) {
    const ex = EXTRACT_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setDocText(ex.document);
    setFields(ex.fields.join("\n"));
    setError(null);
    setResult(null);
  }

  async function runExtract() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          document: docText,
          fields: fields.split("\n").map((l) => l.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong.");
      else setResult(data as ExtractResult);
    } catch {
      setError("Could not reach the extractor. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const canRun = docText.trim().length > 0 && fields.trim().length > 0 && !loading;
  // The banner is green only when nothing needs a human; otherwise it warns.
  const gateClass = result && result.flagged === 0 ? "pass" : "warn";

  return (
    <>
      <header className="head">
        <p className="eyebrow">The Extractor</p>
        <h1>Structured data, without the made-up fields.</h1>
        <p className="lead">
          Paste a messy document and the fields you need. The model pulls them into clean data and{" "}
          <b>flags anything it is not sure about instead of inventing it</b>. A missing field comes
          back <b>missing</b>, an ambiguous one comes back <b>uncertain</b> — so a human checks the
          few that matter, not all of them.
        </p>

        <div className="examples">
          <span className="label">Try one:</span>
          {EXTRACT_EXAMPLES.map((ex) => (
            <button key={ex.id} className="chip" onClick={() => loadExample(ex.id)}>
              {ex.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid">
        {/* ---- inputs ---- */}
        <section className="panel" aria-label="Input">
          <h2>What to extract</h2>

          <div className="field">
            <label htmlFor="document">
              Document <span className="hint">the messy source</span>
            </label>
            <textarea
              id="document"
              className="tall"
              placeholder="Paste an invoice, receipt, email, or any messy text you want turned into structured data."
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="fields">
              Fields <span className="hint">one per line</span>
            </label>
            <textarea
              id="fields"
              className="short"
              placeholder={"Invoice number\nTotal amount\nDue date\nVendor name"}
              value={fields}
              onChange={(e) => setFields(e.target.value)}
            />
          </div>

          <ProviderConfig
            roleLabel="Extractor"
            roleHint="which model pulls the data"
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
            <button onClick={runExtract} disabled={!canRun}>
              {loading ? "Extracting…" : "Extract data"}
            </button>
            <span className="note">
              Try a field that isn&apos;t in the document — it comes back &quot;missing&quot;, not
              invented.
            </span>
          </div>
        </section>

        {/* ---- result ---- */}
        <section className="panel" aria-label="Result" aria-live="polite">
          <h2>Extracted</h2>

          {!result && !error && (
            <p className="result-empty">
              Load an example or paste your own, then extract. Each field comes back as found,
              uncertain, or missing — the flagged ones are what a human should look at.
            </p>
          )}

          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className={`gate ${gateClass}`}>
                <span className="badge">
                  {result.flagged === 0
                    ? "ALL FOUND"
                    : `${result.flagged} FLAGGED`}
                </span>
                <span className="summary">{result.summary}</span>
              </div>

              <div className="items">
                {result.fields.map((f, i) => (
                  <div key={i} className={`item ${f.status}`}>
                    <div className="mark">{MARK[f.status]}</div>
                    <div>
                      <div className="crit">
                        {f.field}
                        <span className="tag">{STATUS_LABEL[f.status]}</span>
                      </div>
                      {f.status !== "missing" && f.value && (
                        <div className="val">{f.value}</div>
                      )}
                      <div className="ev">{f.evidence}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="meta">
                <span>
                  {result.counts.found} found · {result.counts.uncertain} uncertain ·{" "}
                  {result.counts.missing} missing
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
    </>
  );
}
