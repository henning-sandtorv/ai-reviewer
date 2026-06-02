// The contract between the reviewer model and the rest of the app.
//
// The model is FORCED to call submit_review with this exact shape, so we never
// parse free-form prose. It returns a verdict per checklist item; the app — not
// the model — decides whether that adds up to a block. The gate is code.

export type Verdict = "pass" | "fail" | "unsure";

export type ReviewItem = {
  criterion: string;
  verdict: Verdict;
  // A short note pointing at the specific part of the output that triggered the
  // verdict — ideally a quote. This is the "here's exactly what I caught" bit.
  evidence: string;
};

export type ReviewResult = {
  // Computed in code from the item verdicts, not taken from the model.
  decision: "pass" | "block";
  items: ReviewItem[];
  summary: string;
  counts: { pass: number; fail: number; unsure: number };
  model: string;
  ms: number;
};

// JSON Schema for the forced Anthropic tool call.
export const REVIEW_TOOL = {
  name: "submit_review",
  description:
    "Submit the review of the AI output against the checklist. Call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One entry per checklist item, in the same order.",
        items: {
          type: "object",
          properties: {
            criterion: {
              type: "string",
              description: "The checklist item being judged, copied verbatim.",
            },
            verdict: {
              type: "string",
              enum: ["pass", "fail", "unsure"],
              description:
                "pass = the output clearly satisfies it; fail = it clearly violates it; unsure = you cannot tell from what you were given.",
            },
            evidence: {
              type: "string",
              description:
                "One or two sentences. Quote the exact part of the output that drove the verdict.",
            },
          },
          required: ["criterion", "verdict", "evidence"],
        },
      },
      summary: {
        type: "string",
        description: "One sentence on the overall state of the output.",
      },
    },
    required: ["items", "summary"],
  },
} as const;
