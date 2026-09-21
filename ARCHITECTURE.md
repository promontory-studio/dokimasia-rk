# Architecture

One sentence: **the harness owns the loop and the arithmetic; the package that owns the validator
owns the probe.** Everything below follows from that split, including the parts that look like
duplication and are not.

## 1. The spine

```
      host (an application)                    this package                 domain package
  ┌──────────────────────────┐          ┌───────────────────────┐        ┌──────────────────┐
  │ inference.config.json    │          │  runProbe   (loop)    │        │ validate()       │
  │ SDK client instance      │─────────▶│  summarize  (score)   │◀───────│ probe factories  │
  │ which features to run    │          │  bucketRejection      │        │ bucket table     │
  │ the pre-registration text│          │  wilson / rankStacks  │        └──────────────────┘
  └──────────────────────────┘          └───────────────────────┘
```

- The **host** decides *what to measure* — which configuration, which features, which fixtures —
  and supplies the client. It is the only layer that reads a key or touches the network.
- **This package** decides *how a measurement is made and reported*. It constructs no client, reads
  no environment variable, names no vendor, and has no runtime dependencies. All four are asserted
  in `tests/packaging.test.ts`, so they are facts rather than intentions.
- The **domain package** decides *what counts as a pass*, because it is the thing that decides that
  in production.

## 2. Probes live with validators, not with the harness

This is the question that settles the layout, and the answer is the opposite of the intuition that
prompts it.

**A probe is an adapter over a validator, not over an application.** It is a short closure over a
shipped call core: this feature's call, these cases, this many attempts, resolving when the owning
package's own validator accepted the response.

- **Several applications over one domain** all import the same probes from that domain package. One
  definition, no copy, no drift — which is exactly what multiple consumers demands.
- **Several domains** each write their own probes against their own validators, and install this
  package alone.
- The alternative — probes living here — would make this package depend on every domain whose
  validators it adapted. Every consumer would then install a domain it does not use in order to run
  a generic harness, and a third domain's probes would have to be vendored into a package that
  should not know that domain exists.

**The rule, stated once:** the harness never depends on a domain package, and a domain package
never depends on the harness for its production types.

## 3. The `MessagesClient` port, and why it is declared twice

`client.ts` declares the client shape this package calls. A domain package that also needs that
shape in its production code declares its own. That is two declarations of one shape, and it is not
a DRY violation.

DRY forbids two copies of **one fact we own**. This is not that. Both declarations are independent
structural ports onto the same **external** contract — the SDK's `messages.create` /
`messages.stream` — which both packages type-import and neither owns. Structural typing makes them
mutually assignable at zero coupling, and a change in the SDK breaks both identically, at compile
time, with no coordination.

The alternative is worse layering in one direction or the other: either a domain package's
*production* client type depends on a benchmark harness, or this package depends on that domain.
Both are real couplings. Two structural ports are not.

The SDK import is `import type` everywhere, so nothing from it is reachable at runtime — also
asserted in `tests/packaging.test.ts`.

## 4. Load-bearing invariants

These three read like implementation details and are not. Each has a test that is red if it is
removed.

**Bucket order: `unreachable` → `refused` → `unsupported` → quality.** A rejection message is
classified by the first pattern that matches, and the order is the whole content of the
classification. `"fetch failed while retrying: missing field \"unit\""` must bucket as
`unreachable`: the model was never asked, and reporting it as a quality failure would turn a
network fault into evidence about a model. `withDefaults(domainTable)` exists so that a domain
cannot accidentally place a quality pattern ahead of the operational ones — its patterns are
appended, never prepended.

**Censoring: a case that never validated scores `attempts + 1`.** Not `attempts`, which is what a
last-attempt success scores; not `Infinity`, which would claim knowledge of how many more attempts
it would have needed. One worse than the ceiling is the weakest honest statement, and it keeps
`meanAttempts` readable next to a pass rate rather than dominated by failures.

**`runProbe` is serial by design.** A self-hosted server answers one request at a time anyway, and
overlapping calls change what a per-case median second means. Making this concurrent is not an
optimisation; it is a change to the measurement. The test asserts both the order and that
`maxInFlight === 1`.

## 5. Statistics, and the small-`n` problem

A paid run affords one to twelve cases per feature. Every statistical choice here is downstream of
that.

- **Wilson, not the normal approximation.** The normal interval reports `[1.00, 1.00]` for a clean
  sweep — a claim of certainty from twelve observations. Wilson does not.
- **The lower bound is the ordering key** in `rankStacks`, so 1/1 cannot outrank 11/12. See
  [`RANKING.md`](RANKING.md).
- **`signTest` and `minimumDetectableWins`** are for paired comparisons over discordant pairs, and
  exist to be consulted *before* a run: `minimumDetectableWins(5)` is `Infinity`, which is the
  harness telling you that five paired cases cannot produce a significant result no matter how they
  come out.
- **`separatingN`** answers a different question — what `n` would stop two aggregate intervals
  overlapping — and is a separate function for that reason, not a reuse of the sign test.

## 6. What is deliberately absent

- **No runtime dependencies.** Not a boast; a constraint that keeps the harness installable
  anywhere a domain package already is.
- **No build step.** Raw TypeScript ships, with an explicit `files` allowlist and per-module
  `exports`. Sources are what a consumer reads and what a consumer runs.
- **No storage, no reporting service, no dashboard.** The output is a value. Where a number is
  published, and what it is published next to, is the host's decision and [`METHOD.md`](METHOD.md)'s
  subject.
- **No thresholds and no gates.** Nothing here can fail a build on a rate. A measurement that can
  fail a build stops being a measurement and becomes something to be managed.
