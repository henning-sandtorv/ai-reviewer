import { REVIEW_TOOL, type ReviewItem, type ReviewResult, type Verdict } from "./schema";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.REVIEWER_MODEL || "claude-haiku-4-5-20251001";

export type ReviewInput = {
  // The ground truth the output is supposed to be faithful to. Optional — without
  // it the reviewer can still judge tone, format and internal consistency, but it
  // cannot catch a claim that is simply made up.
  source?: string;
  // The AI-generated text under review.
  output: string;
  checklist: string[];
  // Bring-your-own-key. Falls back to the server env key when absent.
  apiKey?: string;
};

const SYSTEM = `You are a strict quality reviewer sitting between an AI and its user. A primary AI produced an OUTPUT for some task. Your only job is to check that OUTPUT against each item of a CHECKLIST.

When SOURCE material is provided, treat it as the single source of truth. Any claim, number, date or fact in the OUTPUT that is not supported by the SOURCE is a fail — do not give the benefit of the doubt, and do not use outside knowledge to excuse it.

For every checklist item return a verdict:
- "pass": the output clearly satisfies the item.
- "fail": the output clearly violates the item.
- "unsure": you genuinely cannot tell from what you were given.

Be skeptical and specific. In each evidence note, quote the exact words from the output that drove your verdict. Judge only what you were given. Return your answer by calling submit_review exactly once.`;

function buildUserMessage(input: ReviewInput): string {
  const parts: string[] = [];
  if (input.source && input.source.trim()) {
    parts.push(`SOURCE (ground truth):\n"""\n${input.source.trim()}\n"""`);
  }
  parts.push(`OUTPUT under review:\n"""\n${input.output.trim()}\n"""`);
  parts.push(
    "CHECKLIST:\n" +
      input.checklist.map((c, i) => `${i + 1}. ${c}`).join("\n")
  );
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

export async function runReview(input: ReviewInput): Promise<ReviewResult> {
  const apiKey = input.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ReviewError(
      "No API key. Paste your Anthropic key in the field below, or set ANTHROPIC_API_KEY on the server.",
      400
    );
  }
  if (!input.output?.trim()) throw new ReviewError("Nothing to review — the output is empty.", 400);
  if (!input.checklist.length) throw new ReviewError("Add at least one checklist item.", 400);

  const started = Date.now();
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [REVIEW_TOOL],
      // Force the structured call so we never have to parse prose.
      tool_choice: { type: "tool", name: REVIEW_TOOL.name },
      messages: [{ role: "user", content: buildUserMessage(input) }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Surface the provider's own message (e.g. bad key, rate limit) but keep it short.
    throw new ReviewError(
      `Reviewer request failed (${res.status}). ${detail.slice(0, 300)}`.trim(),
      res.status === 401 ? 401 : 502
    );
  }

  const data = await res.json();
  const toolUse = Array.isArray(data?.content)
    ? data.content.find((b: { type?: string; name?: string }) => b.type === "tool_use" && b.name === REVIEW_TOOL.name)
    : undefined;

  if (!toolUse?.input?.items) {
    throw new ReviewError("The reviewer did not return a structured verdict.", 502);
  }

  const rawItems = toolUse.input.items as Array<{ criterion?: string; verdict?: string; evidence?: string }>;
  const items: ReviewItem[] = rawItems.map((it) => ({
    criterion: String(it.criterion ?? ""),
    verdict: normalizeVerdict(it.verdict),
    evidence: String(it.evidence ?? ""),
  }));

  const { decision, counts } = decide(items);

  return {
    decision,
    items,
    summary: String(toolUse.input.summary ?? ""),
    counts,
    model: DEFAULT_MODEL,
    ms: Date.now() - started,
  };
}

function normalizeVerdict(v: unknown): Verdict {
  return v === "pass" || v === "fail" || v === "unsure" ? v : "unsure";
}

// A typed error that carries the HTTP status the route should return.
export class ReviewError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
