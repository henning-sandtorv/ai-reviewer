import { runReview, ReviewError, type ProviderId } from "../../../lib/review";

// Runs the checklist review and returns a structured verdict.
// Bring-your-own-key: an apiKey in the body is used for that request only and is
// never logged or stored. Without one, the matching server env key is used.
export async function POST(req: Request) {
  let body: {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    source?: string;
    output?: string;
    checklist?: unknown;
    lessons?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const checklist = Array.isArray(body.checklist)
    ? body.checklist.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const lessons = Array.isArray(body.lessons)
    ? body.lessons.map((l) => String(l).trim()).filter(Boolean)
    : [];
  const provider: ProviderId = body.provider === "openai" ? "openai" : "anthropic";

  try {
    const result = await runReview({
      provider,
      model: body.model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      source: body.source,
      output: String(body.output ?? ""),
      checklist,
      lessons,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof ReviewError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[review] unexpected error", err);
    return Response.json({ error: "The reviewer hit an unexpected error." }, { status: 500 });
  }
}
