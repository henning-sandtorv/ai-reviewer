// Shared provider plumbing for both the Reviewer and the Extractor.
//
// Both features do the same low-level thing: send a system + user message to a
// cheap model and FORCE it to answer through one structured tool call, so we
// never parse free-form prose. The only differences are the prompt and the tool
// schema. That shared mechanism lives here; the features just supply their own
// tool and map the result.

export type ProviderId = "anthropic" | "openai";

export type ToolSpec = {
  name: string;
  description: string;
  // JSON Schema for the tool's single argument object.
  input_schema: Record<string, unknown>;
};

// A typed error that carries the HTTP status the route should return.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function defaultModel(provider: ProviderId): string {
  return provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini";
}

export function defaultBaseUrl(provider: ProviderId): string {
  return provider === "anthropic"
    ? "https://api.anthropic.com/v1"
    : "https://api.openai.com/v1";
}

export function envKey(provider: ProviderId): string | undefined {
  return provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
}

export function normalizeProvider(value: unknown): ProviderId {
  return value === "openai" ? "openai" : "anthropic";
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  const detail = await res.text().catch(() => "");
  throw new ApiError(
    `Model request failed (${res.status}). ${detail.slice(0, 300)}`.trim(),
    res.status === 401 || res.status === 403 ? 401 : 502
  );
}

export type ForcedToolCall = {
  provider: ProviderId;
  key: string;
  model: string;
  baseUrl: string;
  system: string;
  userMessage: string;
  tool: ToolSpec;
  maxTokens?: number;
};

// Send the request and return the tool-call arguments as a raw object. Both
// providers are asked for the SAME tool, so everything downstream is
// provider-agnostic. Returns {} if the model somehow answered without the call.
export async function callForcedTool(opts: ForcedToolCall): Promise<Record<string, unknown>> {
  const maxTokens = opts.maxTokens ?? 1500;
  return opts.provider === "anthropic"
    ? callAnthropic(opts, maxTokens)
    : callOpenAI(opts, maxTokens);
}

async function callAnthropic(opts: ForcedToolCall, maxTokens: number): Promise<Record<string, unknown>> {
  const res = await fetch(`${opts.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.userMessage }],
    }),
  });
  await assertOk(res);
  const data = await res.json();
  const block = Array.isArray(data?.content)
    ? data.content.find(
        (b: { type?: string; name?: string }) => b.type === "tool_use" && b.name === opts.tool.name
      )
    : undefined;
  return (block?.input as Record<string, unknown>) ?? {};
}

async function callOpenAI(opts: ForcedToolCall, maxTokens: number): Promise<Record<string, unknown>> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.userMessage },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: opts.tool.name,
            description: opts.tool.description,
            parameters: opts.tool.input_schema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: opts.tool.name } },
    }),
  });
  await assertOk(res);
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return {};
  try {
    return JSON.parse(args) as Record<string, unknown>;
  } catch {
    return {};
  }
}
