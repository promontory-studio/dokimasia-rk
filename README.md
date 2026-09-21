# dokimasia

[![CI](https://github.com/promontory-studio/dokimasia-rk/actions/workflows/ci.yml/badge.svg)](https://github.com/promontory-studio/dokimasia-rk/actions/workflows/ci.yml) [![Community Health](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/promontory-studio/dokimasia-rk/community/profile&query=$.health_percentage&suffix=%25&label=community%20health)](https://github.com/promontory-studio/dokimasia-rk/community) [![npm](https://img.shields.io/npm/v/@promontory-studio/dokimasia)](https://www.npmjs.com/package/@promontory-studio/dokimasia) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**An assay harness for language-model deployments.** It answers one question — *would my
application have worked on this model?* — and it answers it by running the application's own
validator, on the application's own configuration, and reporting what came back, including when the
answer is *we cannot tell at this n*.

It is domain-free and dependency-free. It names no vendor, no model and no endpoint; it constructs
no client and reads no key. The host supplies both.

```
npm install @promontory-studio/dokimasia
```

## Why it deserves to exist

The comparison set is promptfoo, Inspect, braintrust, Langfuse and lm-eval-harness. Pitched as "an
eval framework" this loses to all five. It is not one. Three things here are in none of them.

1. **The oracle is the shipping validator.** Everyone else judges with a rubric, a reference
   answer, or a second model. Here a case passes exactly when production would have accepted the
   response. That turns *"is this model good"* — unanswerable — into *"would my app have worked"*,
   which is the only question a deployer has. That is a thesis, not a utility.
2. **The unit of measurement is an `inference.config.json`, not a model.** Measuring a candidate is
   literally the same edit as deploying one. Every other tool measures models in a harness that is
   not your app.
3. **Operational honesty the field mostly skips.** `unreachable` is bucketed before `refused`
   before quality, so a model that was never asked never reads as a model that answers badly; and
   attempts are censored, so a ceiling failure is not indistinguishable from a last-attempt
   success.

### Two things this does not pretend

- **General in principle, one domain consumer in practice.** The spine is domain-free and tested as
  such, but until a second domain writes probes against it, that generality is an argument rather
  than a demonstration. The seam it turns on is stated in [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **At the `n` a paid run affords — one to twelve cases per feature — many stack comparisons are
  genuinely not separable.** This is why [`rankStacks`](RANKING.md) reports ties as ties and says
  what `n` would separate them, instead of printing an order between two stacks it cannot tell
  apart.

## Quickstart — one probe, no key, no network

A **probe** is one feature's shipped call plus the cases to run it on. You write it in the package
that owns the validator, because the validator is the oracle.

```ts
import { runProbe, summarize, type Probe } from "@promontory-studio/dokimasia";
import { extractInvoice, InvalidInvoice } from "./invoice.ts"; // your shipped path

interface Case { label: string; pdfBase64: string }

export const invoiceProbe = (cases: Case[]): Probe<Case> => ({
  feature: "invoice",
  cases,
  label: (c) => c.label,
  // How many attempts the SHIPPED path makes. Not a benchmark setting — a fact about production.
  attempts: 3,
  // Resolves when your own validator accepted the response; throws when it never did.
  run: (client, model, c, onRejected) => extractInvoice(client, model, c.pdfBase64, { onRejected }),
});
```

Run it, and score it:

```ts
const outcomes = await runProbe(client, "some-model-id", invoiceProbe(cases));
const score = summarize(outcomes, invoiceProbe(cases));
// { n, passed, passRate, ci: [lo, hi], firstAttemptPassRate, meanAttempts, medianMs, rejections }
```

`client` is anything structurally matching [`MessagesClient`](client.ts) — in production, your SDK
instance; in a test, the zero-dependency fake this package ships:

```ts
import { startFakeOpenAI } from "@promontory-studio/dokimasia/testing/fake-openai";
```

Before paying for a run, print what it would cost and what you committed to:

```ts
import { budget, totalCalls } from "@promontory-studio/dokimasia/budget";
import { renderPreRegistration } from "@promontory-studio/dokimasia/preregistration";
```

And to compare whole configurations rather than eyeballing four tables of per-feature rows:

```ts
import { rankStacks, rankingTable } from "@promontory-studio/dokimasia/rank";
```

## What is in the box

| Module | Import | Holds |
|---|---|---|
| `probe.ts` | `@promontory-studio/dokimasia` | `Probe<C>`, `AnyProbe`, `ProbeOutcome`, `runProbe`, `runProbeCase`, `censored` |
| `client.ts` | `…/client` | `MessagesClient`, `MessagesStream` — a structural port, not a dependency |
| `buckets.ts` | `…/buckets` | `DEFAULT_BUCKETS`, `bucketRejection`, `withDefaults` |
| `score.ts` | `…/score` | `FeatureScore`, `summarize`, `measured`, `MeasuredScore` |
| `budget.ts` | `…/budget` | `budget`, `totalCalls` |
| `stats.ts` | `…/stats` | `wilson`, `successRate`, `signTest`, `minimumDetectableWins`, `withReplicates` |
| `rank.ts` | `…/rank` | `rankStacks`, `rankingTable`, `separatingN`, `StackVerdict` |
| `preregistration.ts` | `…/preregistration` | `PreRegistration`, `renderPreRegistration` |
| `testing/fake-openai.ts` | `…/testing/fake-openai` | a `node:http` fake, so a consumer can test its probes offline |

Published as raw TypeScript — no build step, no `dist/`, sources are what ships. A bundler and
Node ≥ 23.6 run it as-is; plain Node 22 needs `--experimental-strip-types`.

## Documents

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the spine and its seams; why probes live with validators
  and not with the harness; the invariants that are load-bearing rather than incidental.
- [`METHOD.md`](METHOD.md) — the benchmark discipline. What a measured row has to satisfy before it
  is worth publishing, and why a sampled run is pre-registered before it is paid for.
- [`RANKING.md`](RANKING.md) — the six rules `rankStacks` implements, each because the obvious
  implementation is dishonest.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to run it with no key and no network, and the
  anti-vacuity rule the suite holds itself to.

## On the name

δοκιμασία. The verb *dokimazō* is **to assay metal for purity** — the same assaying idea as the
touchstone — and *dokimos* means **assayed, therefore approved**. Its civic sense in Athens was the
scrutiny a candidate passed before being allowed to take office, which is precisely what a harness
that admits or rejects an implementation actually does.

## License

MIT. See [`LICENSE`](LICENSE).
