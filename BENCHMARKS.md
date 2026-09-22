# Benchmarks — what this package's own arithmetic does, measured

This package cannot carry a number about a model. It never constructs a client, and by design the
model numbers belong to the repo that owns the validator — that is what [`METHOD.md`](METHOD.md)
governs, and what `lexi/apps/lexitar/MEASUREMENT.md` is an instance of.

What it *can* settle is its own arithmetic, because that arithmetic is a pure function over
outcomes. So the rows below are not sampled: a corpus generates runs whose **true** pass rates are
known, replays them through the shipped `summarize` / `wilson` / `rankStacks` / `bucketRejection`,
and grades the answer against the generating probabilities. Offline, free, and reproducible from a
seed.

Two of the five rows come out against this package. They are published unchanged, which is the
only reason the other three are worth reading.

## What a row had to do to get here

[`METHOD.md` § *Four rules for a published row*](METHOD.md#four-rules-for-a-published-row) owns the
rules; they are not restated. The one that shaped the work is the second: **a row must be able to
come out differently for an implementation that is correct but different, and you must be able to
name what that implementation would score.** So every row below names its alternative — the
normal approximation, ordering on the point estimate, censoring at `attempts`, a domain-first
bucket table — and that alternative is implemented and run, not asserted about.

## Reproducing this page

```console
$ node benchmarks/arithmetic-corpus.ts
```

No key, no network, no model, and Node ≥ 23.6 (plain Node 22 needs `--experimental-strip-types`).
Every figure on this page is a line of its output at seed `20260921`:

```
seed 20260921 — every figure below reproduces exactly from it

1. interval coverage — how often a 95% interval contains the true rate
   n    wilson    normal approx    normal is a point
    1    95.9%      0.0%           100.0%
    5    95.6%     63.6%            33.8%
   12    95.3%     79.2%            15.5%

2. ordering on the lower bound — 2000 pairs with genuinely different true rates, n=12
   printed an order        5 of 2000 (0.3%)
   ...and it was right     5 of 5 (100.0%)
   counterfactual: order on the point estimate, always printed
   ...wrong                370 of 2000 (18.5%)
   of the 146 pairs a quarter apart, it ordered 5 (3.4%)

3. separatingN's promise — 1995 tied pairs, 1883 named a finite n (median 189)
   the n the TRUE rates needed          median 296
   separated on a fresh run at that n   743 of 1883 (39.5%)

4. censoring at attempts+1 — 300 runs at n=12, pairs differing in pass rate that share a mean-attempts
   censored (shipped)      1103
   uncensored              2398

5. bucket order — 200 rejections, 92 of them transport faults
   misread as quality, defaults first (shipped)   0
   misread as quality, domain table first         52
   agreement on the non-transport rejections      108 of 108
```

`tests/benchmarks.test.ts` asserts the corpus reproduces from its seed, produces *different*
results from a different seed — so the seed is genuinely the input — and that every loop it reports
on had something to iterate.

## 1. The interval — 95.3% coverage at n = 12, against 79.2%

20,000 trials per sample size. Each draws a true rate uniformly, samples `n` Bernoulli outcomes at
it, and asks whether the reported 95% interval contains the rate that generated the data.

| n | Wilson (shipped) | normal approximation | normal collapsed to a point |
|---|---|---|---|
| 1 | **95.9%** | 0.0% | 100.0% |
| 5 | **95.6%** | 63.6% | 33.8% |
| 12 | **95.3%** | 79.2% | 15.5% |

**What it means.** A 95% interval that contains the truth 95% of the time is doing its job; one
that contains it 79% of the time is a 79% interval wearing a 95% label, and the reader has no way
to know. The third column is where it comes from: at n = 12, 15.5% of the time the normal
interval is `[p, p]` — a claim of certainty from twelve calls — and at n = 1 that is *every* time,
which is why its coverage is zero.

**The alternative, named.** `p ± 1.96·√(p(1−p)/n)`, the textbook interval, implemented in the
corpus rather than argued about. It is not a broken implementation; it is the one most people would
write. It scores the middle column.

## 2. Ordering on the lower bound — right 5 times out of 5, and silent 1,995 times out of 2,000

2,000 pairs of stacks with genuinely different true rates, three features each, 12 cases per
feature — the `n` a paid run affords.

| | |
|---|---|
| Pairs the harness was willing to order | **5 of 2,000 (0.3%)** |
| …of which the true order was right | **5 of 5 (100%)** |
| Pairs whose true means differ by ≥ 0.25 | 146 |
| …of which it was willing to order | **5 (3.4%)** |
| The alternative: always print an order, taken from the point estimate | 2,000 of 2,000 |
| …of which the true order was **wrong** | **370 (18.5%)** |

**What it means, and it is the least flattering thing on this page.** At twelve cases per feature
this ranker almost never ranks. Even among pairs a quarter apart — a difference nobody would call
marginal — it printed an order 5 times in 146. The guarantee it buys with that silence is that the
orders it *does* print were all correct; the price is that a deployer expecting a verdict will
usually get `=` and a note.

That is the honest state of the trade, not a defence of it: **the cost of an order you can trust is
that you will rarely be given one.** [`RANKING.md`](RANKING.md) says "not separated at this n is
the most common honest verdict"; the number is 99.7%.

**The alternative, named.** Sort on `point` and print it every time. It always answers, and it is
wrong about which stack is better in 18.5% of pairs. Both columns are real behaviour from the same
2,000 pairs.

## 3. `separatingN` names an `n` that is too small — it separates 39.5% of the time

This row tests the note `rankStacks` prints when it declines to order: *"would need n≈189 per
feature to separate."*

| | |
|---|---|
| Tied pairs | 1,995 |
| …that named a finite `n` | 1,883 (median **189**) |
| The `n` the **true** rates actually needed | median **296** |
| Separated on a fresh run at the named `n` | **743 of 1,883 (39.5%)** |

**What it means.** The function does exactly what its contract says — it solves for the `n` at
which two proportions *this far apart* stop overlapping, "assuming the observed rates hold."
This row prices that assumption, and the price is large. Conditioned on being a tie, the observed
gap at n = 12 is mostly noise; when it happens to overstate the true gap, the `n` derived from it
is too small. Median 189 named against median 296 actually needed is that bias, measured.

**So the honest reading of the note is: a floor, not a plan.** Budget well past the `n` it names —
on this corpus, roughly 1.6× the median — or expect to come back still tied. Nothing in the code
is wrong; what was missing was any number attached to the word "assuming", and now there is one.

This is the row that cost something to publish, and `METHOD.md` is explicit that it gets published
unchanged: a ledger that only records wins is not evidence of anything.

## 4. Censoring at `attempts + 1` — 1,103 collisions against 2,398

300 generated runs at n = 12. A **collision** is a pair of runs with *different* pass rates that
report the *same* mean attempts — indistinguishable in the column a reader is comparing.

| Rule | Colliding pairs |
|---|---|
| Score a failed case at `attempts + 1` (shipped) | **1,103** |
| Score it at `attempts` | 2,398 |

**What it means.** Censoring at one past the ceiling more than halves the number of run pairs that
become indistinguishable in `meanAttempts`. The mechanism is the one
[`ARCHITECTURE.md` §4](ARCHITECTURE.md#4-load-bearing-invariants) argues from: without the `+1`,
"used every attempt and succeeded" and "used every attempt and never succeeded" are the same
number, so every mix of the two that sums alike collapses together.

It does not eliminate collisions — 1,103 remain, because mean attempts is one number over twelve
cases and always will be. The claim is comparative and the row is stated comparatively.

**The alternative, named.** `censored = probe.attempts`, which is what a reasonable person writes
first. It scores the second row.

## 5. Bucket order — 0 transport faults misread, against 52

200 generated rejections, 92 of them transport faults. Two of the four transport messages carry
quality text as well — `fetch failed while retrying: missing field "unit"` — which is the case that
decides the order, and is a real message from a run whose connection dropped mid-correction.

| Table | Transport faults filed as a quality failure |
|---|---|
| `withDefaults(domain)` — operational patterns first (shipped) | **0 of 92** |
| `[...domain, ...DEFAULT_BUCKETS]` — domain patterns first | **52 of 92** |

The two tables agree on **108 of 108** non-transport rejections, which is what makes the
alternative *correct but different* rather than simply broken: it classifies quality failures
identically and differs only where a fault carries both kinds of text.

**What it means.** A connection that dropped mid-correction is not an opinion about a model. Under
a domain-first table, 52 of 92 network faults would have been reported as the model producing bad
output — and a flat run would have read as a bad model rather than a bad afternoon.

## One whole assay, offline

The rows above measure pieces. [`examples/offline-probe.ts`](examples/offline-probe.ts) runs the
whole thing end to end with no key and no network — a shipped `extractInvoice` path with its own
retry loop, its own validator as the oracle, a domain bucket table, two features across two stacks:

```console
$ node examples/offline-probe.ts
  feature "invoice" on frontier
    validated      11/12   92%   95% CI [0.65, 0.99]
    first try       75%
    mean attempts  1.42
    rejections     missing total ×2, invalid JSON ×1, unreachable ×1, bad currency ×1
                   e.g. attempt 1 rejected: missing field "total"
...
| # | stack | score (lower bound) | point | covered | not scored | median s | weakest |
|---|---|---|---|---|---|---|---|
| 1=local | frontier | 65% | 92% | 2/2 | — | 0.0 | invoice: missing total |
| 2=frontier | local | 51% | 79% | 2/2 | — | 0.0 | total: missing total |

ranked on 2 of 2 feature(s) — invoice, total — … Not separated at this n: frontier / local.
frontier vs local would need n≈113 per feature to separate.
```

92% against 79% and it still refuses to put one above the other. Row 2 is why, and row 3 is why
`n≈113` should be read as a floor.

## Not yet measured

Stated so that absence is read as absence rather than as a pass.

- **No model has ever been run through this package.** Every number here is arithmetic over
  generated outcomes. The claim that a probe over a real provider reports what a deployer needs is
  untested *in this repo*; it was tested in the code this package was extracted from.
- **Only one consumer, and it is this package's own origin.** `akesi-pil` has migrated onto it and
  runs no copy of `runProbe`, `summarize` or `wilson` any more. A second domain — one this code was
  never shaped by — has not adopted it, so "domain-free" rests on one migration rather than on a
  pattern. See the README.
- **Nothing about latency.** `medianMs` is carried and printed and never scored; no row here tests
  that it is measured correctly under concurrency, because `runProbe` is serial and there is no
  concurrency to test.
- **Nothing about cost.** `budget()` multiplies out calls; whether its estimate matches a real
  invoice is unmeasured and needs a real invoice.
- **The corpus draws true rates uniformly.** Real features are not uniform — most sit near the top
  of the range — so rows 2 and 3 describe a harder population than a deployer usually faces.
