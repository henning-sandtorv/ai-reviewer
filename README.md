# The Reviewer — AI that catches AI's mistakes

A small, provider-agnostic web app built around one idea: put a second, cheaper
model in front of an expensive one to keep it honest. It has two modes.

**Review** — give it an AI output, the source it should be faithful to, and a
checklist. The reviewer grades every item, quotes the exact words that triggered
each verdict, and the app blocks the output if anything fails. Disagree with a
verdict? Teach it, and it applies your correction to every review after.

**Extract** — give it a messy document (invoice, receipt, email) and the fields
you need. It pulls them into clean structured data and **flags what it isn't sure
of instead of inventing it**: a field that isn't there comes back `missing`, an
ambiguous one comes back `uncertain`, so a human checks the few that matter
rather than all of them.

The point both make: you don't have to trust a single model's output blindly. A
cheap second pass catches the expensive model's mistakes for a fraction of the
cost — whether that's a hallucinated fact or a made-up invoice field.

## The idea in one line

> One model writes. A second, cheaper model checks it against a checklist. Code —
> not the model — decides whether to ship or block. Your corrections become rules
> it follows next time.

## Why it's built this way

- **The gate is code, not vibes.** The reviewer returns a `pass` / `fail` /
  `unsure` verdict per checklist item. The block/ship decision is then computed in
  plain code (`lib/review.ts`): any single `fail` blocks. The model judges; the
  code decides. That separation is the whole reliability argument.
- **It learns from your corrections.** Mark any verdict wrong, write the rule it
  should have followed, and that lesson is stored and sent along with every future
  review. In-context learning, no fine-tuning — transparent and reversible (you
  can read and forget any lesson). Lessons live in your browser's local storage.
- **Use any model.** Anthropic, OpenAI, or any OpenAI-compatible endpoint
  (OpenRouter, Groq, Together, a local Ollama / LM Studio server). Pick the
  provider, optionally set the model and base URL.
- **Structured output, not prose.** The reviewer is *forced* to call a single
  `submit_review` tool with a fixed schema (`lib/schema.ts`), so there's nothing
  to parse and nothing to misread. Same schema for every provider.
- **Bring your own key.** A key pasted in the UI is used for that one request and
  never logged or stored. Deploy it publicly without spending your own credits.

## Try the demo

Click **"Summary with invented facts."** The output quietly turns a 30-day refund
window into 60 days and invents a 10% restocking fee. The reviewer reads it
against the source, flags both, and blocks. Then try **"Faithful product
description"** to watch a clean output pass. Disagree with a call? Hit *"This
verdict is wrong"*, write the rule, and run it again to watch the lesson apply.

Switch to **Extract** and click **"Invoice with a missing field."** The document
has no PO number and two candidate dates. A naive extractor would invent the PO
and silently pick a date; this one returns the PO as `missing` and the due date as
`uncertain`, and marks the rest `found`.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: add a key, or bring your own in the UI
npm run dev
```

Open http://localhost:3000.

You need an API key for whichever provider you choose
([Anthropic](https://console.anthropic.com) or any OpenAI-compatible one). Either
set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `.env.local`, or paste a key into
the field in the app.

## Deploy

It's a standard Next.js app. Import to Vercel, framework preset **Next.js**. Add
`ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` if you want a server fallback key;
otherwise leave them blank and every visitor brings their own.

## Where the pieces live

| File | What it does |
| --- | --- |
| `lib/provider.ts` | Shared provider plumbing: Anthropic + OpenAI-compatible dispatch, forced-tool call, key/model resolution. Both modes use it. |
| `lib/schema.ts` | The Review forced-tool JSON schema and result types — the contract. |
| `lib/review.ts` | Review prompt build, lesson injection, the code-side gate decision. |
| `lib/extract-schema.ts` | The Extract forced-tool schema and result types (`found` / `uncertain` / `missing`). |
| `lib/extract.ts` | Extract prompt build and the "never invent a value" handling. |
| `lib/examples.ts`, `lib/extract-examples.ts` | The preloaded demo cases for each mode. |
| `app/api/review/route.ts`, `app/api/extract/route.ts` | The endpoints. Bring-your-own-key handling. |
| `app/page.tsx` | The shell + mode toggle. |
| `app/components/` | `review-panel`, `extract-panel`, shared `provider-config`. |

## License

MIT.
