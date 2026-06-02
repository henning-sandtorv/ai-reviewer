import { runReview, ReviewError } from "../../../lib/review";

// Runs the checklist review and returns a structured verdict.
// Bring-your-own-key: an apiKey in the body is used for that request only and is
// never logged or stored. Without one, the server's ANTHROPIC_API_KEY is used.
export async function POST(req: Request) {
  let body: { source?: string; output?: string; checklist?: unknown; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const checklist = Array.isArray(body.checklist)
    ? body.checklist.map((c) => String(c).trim()).filter(Boolean)
    : [];

  try {
    const result = await runReview({
      source: body.source,
      output: String(body.output ?? ""),
      checklist,
      apiKey: body.apiKey,
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
