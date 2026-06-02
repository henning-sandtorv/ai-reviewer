# The Reviewer — AI that catches AI's mistakes

A small, provider-agnostic web app that puts a second, cheaper model in front of
an AI's output as a quality gate. You give it the output, the source it should be
faithful to, and a checklist. The reviewer grades every item, quotes the exact
words that triggered each verdict, and the app blocks the output if anything
fails. When you disagree with a verdict, you teach it — and it applies your
correction to every review after.

The point it makes: you don't have to trust a single model's output blindly. A
cheap reviewer catches the expensive model's mistakes for a fraction of the cost,
and it gets better as you correct it.

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
| `lib/schema.ts` | The forced-tool JSON schema and the result types — the contract. |
| `lib/review.ts` | Provider dispatch (Anthropic + OpenAI-compatible), prompt build, lesson injection, the code-side gate decision. |
| `lib/examples.ts` | The preloaded demo cases. |
| `app/api/review/route.ts` | The endpoint. Bring-your-own-key handling. |
| `app/page.tsx` | The UI, including the learning loop. |

## License

MIT.
