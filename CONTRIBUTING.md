# Contributing

## Running it

```
npm install
npm test          # vitest run
npm run check     # tsc --noEmit
```

**The suite needs no network and no credentials.** This package constructs no client and reads no
key; the SDK import is type-only, so nothing from it is reachable from a test that does not pass a
client in. Probe runs are exercised against the fake server this package ships
(`testing/fake-openai.ts`) or against scripted in-memory clients. If a test needs network access or
a secret to pass, that is a bug in the test, not a missing setup step —
`tests/packaging.test.ts` asserts it.

Node ≥ 22. No build step: raw TypeScript is what ships, so what you edit is what a consumer runs.

## Anti-vacuity — a test must be able to fail

A test that passes whether or not the property holds is not a test. This is the rule most easily
broken by accident, in three specific ways:

- **A credential-bound suite is excluded, never `skipIf`'d.** A skip that goes green without its
  inputs is indistinguishable from a pass, in exactly the situation where you most need to tell the
  difference. Live runs live behind an explicit config and an explicit env flag, and a run that
  cannot reach its inputs fails. `tests/packaging.test.ts` greps the suite for conditional skips.
- **Assert the loop had something to iterate.** `probes.length > 0`, `sources.length > 5`,
  `tests.length > 4` — a `for` over an empty array passes every assertion inside it.
- **A broad stub can swallow the exact case a test claims to check.** Prefer the real
  implementation; where a fake is unavoidable, make it fail loudly on an unqueued call rather than
  return a default. `startFakeOpenAI` answers 500 when nothing was queued, for this reason.

New functionality gets its test in the same change, not a follow-up. Prefer writing the test first
— a test written before the code cannot pass vacuously, because it has to be red first.

## What belongs here and what does not

**Belongs here:** the probe loop, the retry accounting, rejection bucketing, the scoring arithmetic,
the statistics, ranking, budgeting, the pre-registration shape, and the offline test server.

**Does not belong here:** probe factories, domain validators, bucket patterns for a specific
domain's quality failures, anything that names a vendor, a model or an endpoint, anything that
reads an environment variable, and any runtime dependency. Probes belong in the package that owns
the validator — [`ARCHITECTURE.md`](ARCHITECTURE.md) §2 is the argument, and it is not negotiable
layering preference, it is what keeps this package installable by a domain it has never heard of.

A change that adds a runtime dependency, an environment read, or a vendor name to a source file
turns a passing assertion in `tests/packaging.test.ts` red. That is the intended behaviour.

## Load-bearing behaviour

Three things look like implementation details, are not, and each has a test that fails if it is
changed: **bucket order**, **censoring at `attempts + 1`**, and **serial execution in `runProbe`**.
[`ARCHITECTURE.md`](ARCHITECTURE.md) §4 says why. If a change needs one of them to move, say so in
the pull request explicitly — do not update the test to match the code.

## Before opening a pull request

- `npm test` and `npm run check` both clean.
- New behaviour has a test that is red without it.
- Docs that state a rule are updated in the one place that owns it, not in two.
- [`METHOD.md`](METHOD.md) is the owner of the benchmark discipline. If a consuming repo restates a
  rule from it, that is the bug.
