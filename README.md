# dokimasia

[![CI](https://github.com/promontory-studio/dokimasia-rk/actions/workflows/ci.yml/badge.svg)](https://github.com/promontory-studio/dokimasia-rk/actions/workflows/ci.yml) [![Community Health](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/promontory-studio/dokimasia-rk/community/profile&query=$.health_percentage&suffix=%25&label=community%20health)](https://github.com/promontory-studio/dokimasia-rk/community) [![npm](https://img.shields.io/npm/v/@promontory-studio/dokimasia)](https://www.npmjs.com/package/@promontory-studio/dokimasia) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

*δοκιμασία — the assay: rubbing a metal against a touchstone to find out what it actually is,
before it is allowed to count as gold. More on the word, and on its second life in Athenian public
life, [below](#on-the-name).*

A model swap is a change you cannot review. The diff is one line — a model id in a config file —
and the suite still passes, because a suite asserts what is true on every run and a model's output
is not. What moved is every feature built on that line, by an amount nothing in the repository
reports. The usual substitutes are a leaderboard someone else measured on someone else's prompts, a
handful of cases pasted into a playground, or shipping it and reading the support queue.

> **New here?** [`START-HERE.md`](START-HERE.md) has two short ways in — three minutes with no code,
> or ten minutes running it.

## What this is for

*Is this model good?* is a question about a model, and it has no answer: good at what, for whom,
under whose prompt. *Would my application have worked on it?* is a question about your application,
and it has exactly one — because your application already contains the thing that decides. Every
feature that puts a model's output in front of a user has a moment where it accepts or rejects that
output: a parse, a schema check, a rule that says a total is required and a currency must be one of
three. That check is not a proxy for correctness. In production it *is* correctness, because a
response it rejects is one no user ever sees.

So the measurement was never the missing part. The missing part is the counting: running the
shipped path over committed cases, spending the attempts the shipped path actually spends, filing
what came back by kind, and turning that into a number that says how sure it is.

> A **probe** is the smallest unit of *would my application have worked* you can run and count: one
> feature's shipped call, the cases to run it on, the number of attempts the shipped path actually
> makes, and — as the oracle — the same `validate()` that decides in production whether a response
> is usable. Not a test, not a rubric, not a grade.

Running one takes four parts, and no more than four:

| Part | What it is | Where it comes from |
|---|---|---|
| **Oracle** | the check that already decides, in production, whether a response can be shown | your application |
| **Unit** | one feature's shipped call, and the cases it runs on, committed like any other fixture | your application |
| **Accounting** | attempts counted the way the retry loop spends them, rejections filed by kind, a ceiling failure kept distinguishable from a last-attempt save | this package |
| **Verdict** | an interval rather than a score, and a refusal to order two configurations the evidence cannot separate | this package |

The first two rows are why a probe cannot live in this repository, and the first row is not a detail
of the setup. Swap the oracle for a rubric or a second model and you have not made the measurement
less rigorous — you have changed the question back into the one with no answer.

**An assay harness for language-model deployments.** It is domain-free and dependency-free: it names
no vendor, no model and no endpoint; it constructs no client and reads no key. The host supplies
both.

```
npm install @promontory-studio/dokimasia
```

That install pulls in nothing. `@anthropic-ai/sdk` is an *optional* peer, reached by `import type`
only, so it is needed just to type-check the `client` and `probe` subpaths — and a consumer of those
is holding an SDK instance already. Taking `wilson` should not cost you an HTTP client.

## Not an eval framework

The comparison set is promptfoo, Inspect, braintrust, Langfuse and lm-eval-harness. Pitched as "an
eval framework" this loses to all five. It is not one. Three things here are in none of them.

1. **The oracle is the shipping validator.** Everyone else judges with a rubric, a reference answer,
   or a second model. Here a case passes exactly when production would have accepted the response.
2. **The unit of measurement is an `inference.config.json`, not a model.** Measuring a candidate is
   literally the same edit as deploying one. Every other tool measures models in a harness that is
   not your app.
3. **Operational honesty the field mostly skips.** `unreachable` is bucketed before `refused` before
   quality, so a model that was never asked never reads as a model that answers badly; and attempts
   are censored, so a ceiling failure is not indistinguishable from a last-attempt success.

The cost of the first point is that this package can never be used on its own. Without a validator
there is no oracle, and without an oracle there is nothing here but arithmetic.

## What this does not claim

- **One domain consumes it, and it is the domain this was extracted from.**
  [`akesi-pil`](https://github.com/pablo-tech/pilos/tree/main/akesi-pil) now imports the probe loop,
  the bucketing and the statistics it used to carry in duplicate, and keeps only the five probes its
  own `validate()` judges. That is the seam holding under a real migration — nothing had to move the
  other way — but it is not evidence that a domain this package was never shaped by would fit. Until
  a second one adopts it, "domain-free" is a property of the code, its own tests and one migration.
  The seam it turns on is stated in
  [`ARCHITECTURE.md` § *Probes live with validators*](ARCHITECTURE.md#2-probes-live-with-validators-not-with-the-harness).
- **At the `n` a paid run affords — one to twelve cases per feature — many comparisons are genuinely
  not separable.** This is why [`rankStacks`](RANKING.md) reports ties as ties and says what `n`
  would separate them, instead of printing an order between two configurations it cannot tell apart.
  [`BENCHMARKS.md` § 2](BENCHMARKS.md#2-ordering-on-the-lower-bound--right-5-times-out-of-5-and-silent-1995-times-out-of-2000)
  prices that refusal: at twelve cases per feature it declines to order 99.7% of pairs whose true
  rates genuinely differ.

## What has actually been measured

No model has ever been run through this package — it constructs no client, and the model numbers
belong to the repo that owns the validator. What it *can* settle is its own arithmetic, because that
arithmetic is a pure function over outcomes: generate runs whose true pass rates are known, replay
them through the shipped code, and grade the answer against the probabilities that generated the
data.

[`BENCHMARKS.md`](BENCHMARKS.md) is that page — five rows, each naming the correct-but-different
implementation it discriminates against, reproducible offline from one seed. Two of the five come
out against this package and are published unchanged, which is what
[`METHOD.md`](METHOD.md#one-page-owns-the-numbers) requires and the only reason the other three are
worth reading.

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
| `testing/fake-openai.ts` | `…/testing/fake-openai` | a `node:http` fake for a consumer whose own client speaks OpenAI's chat-completions API |

The `client` a probe receives is anything structurally matching [`MessagesClient`](client.ts) — in
production your SDK instance, in a test a scripted object with a `messages.create` that returns the
reply you queued. [`examples/offline-probe.ts`](examples/offline-probe.ts) is one, in about fifteen
lines. The fake server is a different tool for a different seam: it is an HTTP endpoint, so it is
what a consumer points its *own* OpenAI-shaped client at.

Published as raw TypeScript — no build step, no `dist/`, sources are what ships. The cost is
specific, and worth knowing before you install: **plain `node` cannot import it.** Node refuses to
strip types for anything under `node_modules`, at every version and behind every flag, so a bare
`import` gets `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` rather than a module. A bundler, `tsx`,
or any TypeScript toolchain reads it as-is — those are what this package supports, verified against
the published tarball rather than against a working copy.

## Documents

- [`START-HERE.md`](START-HERE.md) — two ways in: three minutes with no code, or ten minutes running
  the worked example and breaking one invariant on purpose.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the spine and its seams; why probes live with validators
  and not with the harness; the invariants that are load-bearing rather than incidental.
- [`METHOD.md`](METHOD.md) — the benchmark discipline. What a measured row has to satisfy before it
  is worth publishing, and why a sampled run is pre-registered before it is paid for.
- [`RANKING.md`](RANKING.md) — the six rules `rankStacks` implements, each because the obvious
  implementation is dishonest.
- [`BENCHMARKS.md`](BENCHMARKS.md) — what this package's own arithmetic does, measured offline
  against known true rates, including the two rows where it comes off badly.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to run it with no key and no network, and the
  anti-vacuity rule the suite holds itself to.

## On the name

δοκιμασία. The verb *dokimazō* is **to assay metal for purity** — the same assaying idea as the
touchstone — and *dokimos* means **assayed, therefore approved**. Its civic sense in Athens was the
scrutiny a candidate passed before being allowed to take office, which is precisely what a harness
that admits or rejects an implementation actually does.

## License

MIT. See [`LICENSE`](LICENSE).
