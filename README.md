# The Reviewer — AI that catches AI's mistakes

A small web app that puts a second, cheaper model in front of an AI's output as a
quality gate. You give it the output, the source it should be faithful to, and a
checklist. The reviewer grades every item, quotes the exact words that triggered
each verdict, and the app blocks the output if anything fails.

The point it makes: you don't have to trust a single model's output blindly. A
cheap reviewer catches the expensive model's mistakes for a fraction of the cost.

## The idea in one line

> One model writes. A second, cheaper model checks it against a checklist. Code —
> not the model — decides whether to ship or block.

## Why it's built this way

- **The gate is code, not vibes.** The reviewer returns a `pass` / `fail` /
  `unsure` verdict per checklist item. The block/ship decision is then computed in
  plain code (`lib/review.ts`): any single `fail` blocks. The model judges; the
  code decides. That separation is the whole reliability argument.
- **Structured output, not prose.** The reviewer is *forced* to call a single
  `submit_review` tool with a fixed schema (`lib/schema.ts`), so there's nothing
  to parse and nothing to misread.
- **A cheap model on purpose.** The reviewer defaults to Haiku. The demo is that a
  small, cheap model reliably catches a larger model's slip-ups.
- **Bring your own key.** A key pasted in the UI is used for that one request and
  never logged or stored. Deploy it publicly without spending your own credits.

## Try the demo

Click **"Summary with invented facts."** The output quietly turns a 30-day refund
window into 60 days and invents a 10% restocking fee. The reviewer reads it
against the source, flags both, and blocks. Then try **"Faithful product
description"** to watch a clean output pass.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY, or bring your own key in the UI
npm run dev
```

Open http://localhost:3000.

You need an Anthropic API key ([console.anthropic.com](https://console.anthropic.com)).
Either set `ANTHROPIC_API_KEY` in `.env.local`, or paste a key into the field in
the app.

## Deploy

It's a standard Next.js app. Import to Vercel, framework preset **Next.js**. Add
`ANTHROPIC_API_KEY` as an environment variable if you want a server fallback key;
otherwise leave it blank and every visitor brings their own.

## Where the pieces live

| File | What it does |
| --- | --- |
| `lib/schema.ts` | The forced-tool JSON schema and the result types — the contract. |
| `lib/review.ts` | Builds the prompt, calls the reviewer, computes the gate decision. |
| `lib/examples.ts` | The preloaded demo cases. |
| `app/api/review/route.ts` | The endpoint. Bring-your-own-key handling. |
| `app/page.tsx` | The UI. |

## License

MIT.
