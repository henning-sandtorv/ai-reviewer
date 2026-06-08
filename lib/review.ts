import { REVIEW_TOOL, type ReviewItem, type ReviewResult, type Verdict } from "./schema";
import {
  ApiError,
  callForcedTool,
  defaultBaseUrl,
  defaultModel,
  envKey,
  normalizeProvider,
  type ProviderId,
} from "./provider";

export type { ProviderId } from "./provider";
// Kept as a named export so existing callers (the route) don't have to change.
export { ApiError as ReviewError } from "./provider";

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

export async function runReview(input: ReviewInput): Promise<ReviewResult> {
  const provider = normalizeProvider(input.provider);
  const key = input.apiKey?.trim() || envKey(provider);
  if (!key) {
    throw new ApiError(
      "No API key. Paste your key in the field below, or set the matching server env key.",
      400
    );
  }
  if (!input.output?.trim()) throw new ApiError("Nothing to review — the output is empty.", 400);
  if (!input.checklist.length) throw new ApiError("Add at least one checklist item.", 400);

  const model = input.model?.trim() || process.env.REVIEWER_MODEL || defaultModel(provider);
  const baseUrl = (input.baseUrl?.trim() || defaultBaseUrl(provider)).replace(/\/+$/, "");

  const started = Date.now();
  const raw = (await callForcedTool({
    provider,
    key,
    model,
    baseUrl,
    system: buildSystem(input.lessons),
    userMessage: buildUserMessage(input),
    tool: REVIEW_TOOL,
  })) as RawReview;

  if (!raw.items) throw new ApiError("The reviewer did not return a structured verdict.", 502);

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
