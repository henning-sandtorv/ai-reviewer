// The contract between the extractor model and the rest of the app.
//
// Same idea as the reviewer's schema: the model is FORCED to call submit_extraction
// with this exact shape, so we never parse free-form JSON out of prose. For every
// requested field it returns a status. The point of the whole mode is the "uncertain"
// and "missing" states: instead of silently inventing a value when the document is
// ambiguous or simply doesn't contain the field, it flags it for a human.

export type FieldStatus = "found" | "uncertain" | "missing";

export type ExtractedField = {
  // The field that was requested, copied verbatim.
  field: string;
  // The extracted value. Empty string when status is "missing".
  value: string;
  status: FieldStatus;
  // Where in the document the value came from (a short quote), or why it is
  // uncertain / missing. This is the "show your work" bit.
  evidence: string;
};

export type ExtractResult = {
  fields: ExtractedField[];
  summary: string;
  // Computed in code from the statuses, not taken from the model.
  counts: { found: number; uncertain: number; missing: number };
  // found + ... how many need a human look (uncertain + missing).
  flagged: number;
  model: string;
  provider: "anthropic" | "openai";
  ms: number;
};

// JSON Schema for the forced tool call. Kept structurally parallel to REVIEW_TOOL.
export const EXTRACT_TOOL = {
  name: "submit_extraction",
  description:
    "Submit the structured data extracted from the document. Call this exactly once, with one entry per requested field, in the same order.",
  input_schema: {
    type: "object",
    properties: {
      fields: {
        type: "array",
        description: "One entry per requested field, in the same order.",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              description: "The requested field name, copied verbatim.",
            },
            value: {
              type: "string",
              description:
                "The extracted value, normalized sensibly. Empty string if the field is missing. Never invent a value.",
            },
            status: {
              type: "string",
              enum: ["found", "uncertain", "missing"],
              description:
                "found = the value is clearly present in the document; uncertain = present but ambiguous, conflicting, or partial (give your best read but flag it); missing = the document does not contain it (leave value empty, do not guess).",
            },
            evidence: {
              type: "string",
              description:
                "One or two sentences. Quote the exact part of the document the value came from, or explain why it is uncertain or missing.",
            },
          },
          required: ["field", "value", "status", "evidence"],
        },
      },
      summary: {
        type: "string",
        description: "One sentence on the overall state of the extraction.",
      },
    },
    required: ["fields", "summary"],
  },
} as const;
