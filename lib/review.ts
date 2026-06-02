import { REVIEW_TOOL, type ReviewItem, type ReviewResult, type Verdict } from "./schema";

export type ProviderId = "anthropic" | "openai";

export type ReviewInput = {
  provider: ProviderId;
  // Optional overrides. Model falls back to a cheap default per provider; baseUrl
  // lets you point "openai" at any OpenAI-compatible endpoint (OpenRouter, Groq,
  // Together, a local Ollama / LM Studio server, …).
  model?: string;
  baseUrl?: string;
  // Bring-your-own-key. Falls back to the server env key for the chosen provider.
  apiKey?: string;
  // The ground truth the output should be faithful to. Optional — without it the
  // reviewer can still judge tone, format and internal consistency, but it cannot
  // catch a claim that is simply made up.
  source?: string;
  // The AI-generated text under review.
  output: string;
  checklist: string[];
  // Corrections from past reviews. These are injected into the reviewer's prompt
  // so it stops repeating mistakes a human already flagged — in-context learning,
  // no fine-tuning. Capped so the prompt can't grow without bound.
  lessons?: string[];
};

const MAX_LESSONS = 40;

function defaultModel(provider: ProviderId): string {
  return provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini";
}

function defaultBaseUrl(provider: ProviderId): string {
  return provider === "anthropic"
    ? "https://api.anthropic.com/v1"
    : "https://api.openai.com/v1";
}

function envKey(provider: ProviderId): string | undefined {
  return provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
}

const BASE_SYSTEM = `You are a strict quality reviewer sitting between an AI and its user. A primary AI produced an OUTPUT for some task. Your only job is to check that OUTPUT against each item of a CHECKLIST.

When SOURCE material is provided, treat it as the single source of truth. Any claim, number, date or fact in the OUTPUT that is not supported by the SOURCE is a fail — do not give the benefit of the doubt, and do not use outside knowledge to excuse it.

For every checklist item return a verdict:
- "pass": the output clearly satisfies the item.
- "fail": the output clearly violates the item.
- "unsure": you genuinely cannot tell from what you were given.

Be skeptical and specific. In each evidence note, quote the exact words from the output that drove your verdict. Judge only what you were given. Return your answer by calling submit_review exactly once.`;

function buildSystem(lessons?: string[]): string {
  const clean = (lessons ?? []).map((l) => l.trim()).filter(Boolean).slice(0, MAX_LESSONS);
  if (!clean.length) return BASE_SYSTEM;
  return (
    BASE_SYSTEM +
    "\n\nLESSONS FROM PAST CORRECTIONS — a human reviewer corrected you on earlier reviews. Apply each of these so you do not repeat the mistake:\n" +
    clean.map((l) => `- ${l}`).join("\n")
  );
}

function buildUserMessage(input: ReviewInput): string {
  const parts: string[] = [];
  if (input.source && input.source.trim()) {
    parts.push(`SOURCE (ground truth):\n"""\n${input.source.trim()}\n"""`);
  }
  parts.push(`OUTPUT under review:\n"""\n${input.output.trim()}\n"""`);
  parts.push("CHECKLIST:\n" + input.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n"));
  return parts.join("\n\n");
}

// Turn per-item verdicts into a single gate decision. This is deliberately in
// code, not left to the model: any single fail blocks. "unsure" is surfaced but
// does not block on its own — it is a flag for a human, not a hard stop.
function decide(items: ReviewItem[]): { decision: "pass" | "block"; counts: ReviewResult["counts"] } {
  const counts = { pass: 0, fail: 0, unsure: 0 };
  for (const it of items) counts[it.verdict] += 1;
  return { decision: counts.fail > 0 ? "block" : "pass", counts };
}

function normalizeVerdict(v: unknown): Verdict {
  return v === "pass" || v === "fail" || v === "unsure" ? v : "unsure";
}

type RawReview = { items?: Array<{ criterion?: string; verdict?: string; evidence?: string }>; summary?: string };

// ---- provider calls -------------------------------------------------------
// Both providers are asked for the SAME structured tool call, so everything
// downstream is provider-agnostic.

async function callAnthropic(input: ReviewInput, key: string, model: string, baseUrl: string): Promise<RawReview> {
  const res = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: buildSystem(input.lessons),
      tools: [REVIEW_TOOL],
      tool_choice: { type: "tool", name: REVIEW_TOOL.name },
      messages: [{ role: "user", content: buildUserMessage(input) }],
    }),
  });
  await assertOk(res);
  const data = await res.json();
  const block = Array.isArray(data?.content)
    ? data.content.find((b: { type?: string; name?: string }) => b.type === "tool_use" && b.name === REVIEW_TOOL.name)
    : undefined;
  return (block?.input as RawReview) ?? {};
}

async function callOpenAI(input: ReviewInput, key: string, model: string, baseUrl: string): Promise<RawReview> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: buildSystem(input.lessons) },
        { role: "user", content: buildUserMessage(input) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: REVIEW_TOOL.name,
            description: REVIEW_TOOL.description,
            parameters: REVIEW_TOOL.input_schema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: REVIEW_TOOL.name } },
    }),
  });
  await assertOk(res);
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return {};
  try {
    return JSON.parse(args) as RawReview;
  } catch {
    return {};
  }
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  const detail = await res.text().catch(() => "");
  throw new ReviewError(
    `Reviewer request failed (${res.status}). ${detail.slice(0, 300)}`.trim(),
    res.status === 401 || res.status === 403 ? 401 : 502
  );
}

// ---- entry point ----------------------------------------------------------

export async function runReview(input: ReviewInput): Promise<ReviewResult> {
  const provider: ProviderId = input.provider === "openai" ? "openai" : "anthropic";
  const key = input.apiKey?.trim() || envKey(provider);
  if (!key) {
    throw new ReviewError(
      "No API key. Paste your key in the field below, or set the matching server env key.",
      400
    );
  }
  if (!input.output?.trim()) throw new ReviewError("Nothing to review — the output is empty.", 400);
  if (!input.checklist.length) throw new ReviewError("Add at least one checklist item.", 400);

  const model = input.model?.trim() || process.env.REVIEWER_MODEL || defaultModel(provider);
  const baseUrl = (input.baseUrl?.trim() || defaultBaseUrl(provider)).replace(/\/+$/, "");

  const started = Date.now();
  const raw = provider === "anthropic"
    ? await callAnthropic(input, key, model, baseUrl)
    : await callOpenAI(input, key, model, baseUrl);

  if (!raw.items) throw new ReviewError("The reviewer did not return a structured verdict.", 502);

  const items: ReviewItem[] = raw.items.map((it) => ({
    criterion: String(it.criterion ?? ""),
    verdict: normalizeVerdict(it.verdict),
    evidence: String(it.evidence ?? ""),
  }));

  const { decision, counts } = decide(items);

  return {
    decision,
    items,
    summary: String(raw.summary ?? ""),
    counts,
    model,
    provider,
    ms: Date.now() - started,
  };
}

// A typed error that carries the HTTP status the route should return.
export class ReviewError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
