import {
  EXTRACT_TOOL,
  type ExtractResult,
  type ExtractedField,
  type FieldStatus,
} from "./extract-schema";
import {
  ApiError,
  callForcedTool,
  defaultBaseUrl,
  defaultModel,
  envKey,
  normalizeProvider,
  type ProviderId,
} from "./provider";

export type ExtractInput = {
  provider: ProviderId;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  // The messy document to pull data out of (pasted text from a PDF, invoice, email…).
  document: string;
  // The fields the caller wants, one label per entry.
  fields: string[];
};

const SYSTEM = `You are a careful data-extraction step sitting between a document and a system that will store structured data. You are given a DOCUMENT and a list of FIELDS to extract from it.

Extract each field and return a status:
- "found": the value is clearly present in the document. Give the value, normalized sensibly.
- "uncertain": the value is present but ambiguous, conflicting, partial, or you are not confident. Give your best read AND flag it.
- "missing": the document does not contain this field.

The single most important rule: NEVER invent a value. If a field is not in the document, mark it "missing" and leave the value empty. A made-up value is worse than an honest "missing". When in doubt between "found" and "uncertain", choose "uncertain" — a human will check the flagged ones.

In each evidence note, quote the exact part of the document the value came from, or say why it is uncertain or missing. Return your answer by calling submit_extraction exactly once.`;

function buildUserMessage(input: ExtractInput): string {
  return [
    `DOCUMENT:\n"""\n${input.document.trim()}\n"""`,
    "FIELDS to extract:\n" + input.fields.map((f, i) => `${i + 1}. ${f}`).join("\n"),
  ].join("\n\n");
}

function normalizeStatus(s: unknown): FieldStatus {
  return s === "found" || s === "uncertain" || s === "missing" ? s : "uncertain";
}

// Count statuses and derive how many need a human look. In code, not the model.
function tally(fields: ExtractedField[]): { counts: ExtractResult["counts"]; flagged: number } {
  const counts = { found: 0, uncertain: 0, missing: 0 };
  for (const f of fields) counts[f.status] += 1;
  return { counts, flagged: counts.uncertain + counts.missing };
}

type RawExtraction = {
  fields?: Array<{ field?: string; value?: string; status?: string; evidence?: string }>;
  summary?: string;
};

export async function runExtraction(input: ExtractInput): Promise<ExtractResult> {
  const provider = normalizeProvider(input.provider);
  const key = input.apiKey?.trim() || envKey(provider);
  if (!key) {
    throw new ApiError(
      "No API key. Paste your key in the field below, or set the matching server env key.",
      400
    );
  }
  if (!input.document?.trim()) throw new ApiError("Nothing to extract from — the document is empty.", 400);
  if (!input.fields.length) throw new ApiError("Add at least one field to extract.", 400);

  const model = input.model?.trim() || process.env.EXTRACTOR_MODEL || defaultModel(provider);
  const baseUrl = (input.baseUrl?.trim() || defaultBaseUrl(provider)).replace(/\/+$/, "");

  const started = Date.now();
  const raw = (await callForcedTool({
    provider,
    key,
    model,
    baseUrl,
    system: SYSTEM,
    userMessage: buildUserMessage(input),
    tool: EXTRACT_TOOL,
  })) as RawExtraction;

  if (!raw.fields) throw new ApiError("The extractor did not return structured data.", 502);

  const fields: ExtractedField[] = raw.fields.map((f) => {
    const status = normalizeStatus(f.status);
    return {
      field: String(f.field ?? ""),
      // A "missing" field never carries a value, even if the model put one there.
      value: status === "missing" ? "" : String(f.value ?? ""),
      status,
      evidence: String(f.evidence ?? ""),
    };
  });

  const { counts, flagged } = tally(fields);

  return {
    fields,
    summary: String(raw.summary ?? ""),
    counts,
    flagged,
    model,
    provider,
    ms: Date.now() - started,
  };
}
