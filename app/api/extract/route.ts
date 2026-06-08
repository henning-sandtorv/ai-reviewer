import { runExtraction } from "../../../lib/extract";
import { ApiError, normalizeProvider } from "../../../lib/provider";

// Pulls structured data out of a messy document, flagging fields it is unsure
// about instead of inventing them.
// Bring-your-own-key: an apiKey in the body is used for that request only and is
// never logged or stored. Without one, the matching server env key is used.
export async function POST(req: Request) {
  let body: {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    document?: string;
    fields?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const fields = Array.isArray(body.fields)
    ? body.fields.map((f) => String(f).trim()).filter(Boolean)
    : [];

  try {
    const result = await runExtraction({
      provider: normalizeProvider(body.provider),
      model: body.model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      document: String(body.document ?? ""),
      fields,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[extract] unexpected error", err);
    return Response.json({ error: "The extractor hit an unexpected error." }, { status: 500 });
  }
}
