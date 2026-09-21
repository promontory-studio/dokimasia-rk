# Changelog

All notable changes to this package are documented here. This project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **`summarize` reports an unrun feature as unmeasured, not as a zero.** `passRate`,
  `firstAttemptPassRate`, `meanAttempts` and `medianMs` are now `number | null`, and are `null` when
  `n` is 0; `ci` stays the full `[0, 1]`. `METHOD.md` reserves zero for a feature that was asked and
  failed, and the old zeros were being averaged into stack scores as if they were measurements.
  Read a score through the new `measured()` type guard, or widen to `number | null`.

### Fixed

- **`rankStacks` no longer prints an order underneath `NOTHING IS RANKED`.** With no feature scored
  on every stack it returns `ranked: []` and `ties: []`, and `rankingTable` prints the note with no
  rows — previously two stacks that each went 12/12 on different features came back ranked `1=`/`2=`
  at 0%, with a spurious `n≈∞` tie note, which `RANKING.md` explicitly calls incorrect output.
- A feature present in `scores` with `n` of 0 no longer counts as common ground between two stacks;
  it is reported in `unmeasured`, where it belongs.
- **`weakest` is chosen from the features the score was computed over, and ordered on the interval's
  lower bound.** It was picked from every score the stack had, ordered on the point estimate — so the
  column could name a feature the ranking deliberately excluded, using a number rule 1 does not rank
  on.
- **The tie marker names its partners** (`2=a,c`) instead of a bare `=`. Interval overlap is not
  transitive, so a chain of tied pairs was printing as one undifferentiated tied group.

## [0.1.1] — 2026-09-21

### Changed

- Both `github/codeql-action` pins moved to the current `v4.38.1` commit. Dependabot proposed only
  `analyze`; pinning the pair to different commits of one action is the failure mode that makes a
  SHA pin worthless, so they move together.

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

[Unreleased]: https://github.com/promontory-studio/dokimasia/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/promontory-studio/dokimasia/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/promontory-studio/dokimasia/releases/tag/v0.1.0
