# Changelog

All notable changes to this package are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-09-21

First release. The harness was extracted from a clinical-reasoning package, where it had been
written and used against a real deployment decision; nothing here was designed in the abstract.

### Added

- `probe.ts` — `Probe<C>`, `AnyProbe`, `ProbeOutcome`, `runProbe`, `runProbeCase`, `censored`.
  Serial execution and `attempts + 1` censoring are load-bearing, not incidental.
- `client.ts` — `MessagesClient` / `MessagesStream`, declared as a structural port rather than
  imported, so the harness depends on no domain package and no SDK at runtime.
- `buckets.ts` — `DEFAULT_BUCKETS`, `bucketRejection`, `withDefaults`. The bucket table is now an
  argument, so a consumer's domain-specific quality reasons never reach another consumer, and
  `withDefaults` makes it impossible for a domain to order a quality reason ahead of `unreachable`.
- `score.ts` — `summarize`, producing pass rate with a Wilson interval, first-attempt rate, censored
  mean attempts, median latency, and rejection buckets with a real example each.
- `stats.ts` — `wilson`, `successRate`, `signTest`, `minimumDetectableWins`, `withReplicates`
  (generalised from a domain-typed version).
- `budget.ts` — `budget`, `totalCalls`: what a run would cost in calls, before one is made.
- `rank.ts` — **new capability.** `rankStacks` gives one comparable verdict per configuration,
  ranked on Wilson lower bounds over the intersection of features every stack was scored on, with
  ties reported as ties and `separatingN` saying what `n` would break them.
- `preregistration.ts` — `PreRegistration` and `renderPreRegistration`, so a run's registration is
  a value and a page quoting it can assert equality instead of drifting from it.
- `testing/fake-openai.ts` — a zero-dependency `node:http` fake, published so a consumer can test
  its own probes offline. Its SSE mode splits each event across two writes on purpose, so a
  consumer's line buffering is actually exercised.
- Full documentation set: `README`, `ARCHITECTURE`, `METHOD`, `RANKING`, `CONTRIBUTING`, `SECURITY`,
  `CODE_OF_CONDUCT`.

[Unreleased]: https://github.com/promontory-studio/dokimasia/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/promontory-studio/dokimasia/releases/tag/v0.1.0
