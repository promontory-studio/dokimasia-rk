# Ranking — one verdict per stack

A **stack** is a whole configuration: every feature's model, in one file, the same file the
application deploys. `rankStacks` turns a set of measured stacks into one ordered table, so a
deployer picks between configurations instead of reading four per-feature tables side by side.

```ts
import { rankStacks, rankingTable } from "@promontory-studio/dokimasia/rank";

const ranking = rankStacks(
  [
    { stack: "default", scores: defaultScores },
    { stack: "mixed", scores: mixedScores },
    { stack: "open-local", scores: openScores, unsupported: ["document"] },
  ],
  { features: ["ranges", "extract", "document", "treatmentText"] },
);

console.log(rankingTable(ranking));
```

Six rules. Each exists because the obvious implementation is dishonest at the `n` a paid run can
afford, and each is a test in `tests/rank.test.ts` that goes red if its rule is removed.

## 1. Order on the interval's lower bound, never the point estimate

A stack that went 1/1 must not outrank one that went 11/12. `score` is the weighted mean of Wilson
**lower** bounds; `point` is the weighted mean of point estimates and is printed beside it, never
used to order. The lower bound is what a deployer is actually choosing on: the worst the evidence
is consistent with.

## 2. Rank on the intersection — coverage cannot buy a win

`comparable` is the set of features **every** stack was scored on, and the means are taken over
that set alone. A mean over stack A's four features compared against a mean over stack B's two
different features compares nothing, and lets a narrow stack win by declaring less capability.

Coverage is reported beside the score — `covered / total`, with `unsupported` and `unmeasured`
named — where a reader can weigh it against the score rather than have it silently folded in.

When no feature was scored on every stack, the ranking says **`NOTHING IS RANKED`** and names why.
That is the correct output; an order would not be.

## 3. `unsupported` and `unmeasured` are distinct, and neither is a zero

- **`unsupported`** — the stack *declared* it cannot serve this feature. No call was made. Scoring
  it zero would report a measurement nobody took.
- **`unmeasured`** — the stack could have served it and the run did not happen. Also not a zero,
  and not silently dropped either: it appears by name.
- **Zero** is reserved for a feature that was asked and failed.

An unmeasured feature therefore does not drag a stack's score down, and does not flatter it either
— it is excluded from the comparable set for every stack at once, so no stack gains from another's
gap.

## 4. Latency is reported beside the score, never inside it

`medianMs` sits in the verdict and in the table; it is never folded into `score`. One number that
blends quality and speed flatters whichever of the two the author prefers, and the weighting is
invisible to the reader. A stack whose median is 244 seconds and one whose median is 0.9 seconds
score identically at equal pass rates — and the table shows both numbers, side by side, to a reader
who knows which of the two they are buying.

## 5. Overlapping intervals are a tie, and the tie says what would break it

Two stacks whose intervals overlap are reported in `ties` as an unordered pair, marked `=` in the
table, and the note says what `n` per feature would separate them at the observed rates
(`separatingN`). When the rates are identical it says `n≈∞`, which is the honest answer.

Ties are pairs, not groups. Interval overlap is not transitive — A can overlap B and B overlap C
while A and C separate cleanly — so reporting connected components would overstate what is
indistinguishable.

## 6. Weights are declared before the run, and the default is a declared choice

`weights` is optional and defaults to equal-per-feature. The note says so in words: *"equal weight
per feature — itself a choice, stated rather than assumed."* Equal weighting is not the absence of
a decision; it is the decision that every feature matters the same, which is rarely true and should
be visible when it is assumed.

Named weights are printed in the note as `feature×n`, so a table can never be read without the
weighting that produced it.

## Reading a `StackVerdict`

| Field | Means |
|---|---|
| `score` | Weighted mean of Wilson lower bounds over `comparable`. **The ordering key.** |
| `point` | Weighted mean of point estimates. Printed, never ordered on. |
| `ceiling` | Weighted mean of Wilson upper bounds. Used only to decide whether two stacks separated. |
| `covered` / `total` | Features served and measured, out of features asked for. |
| `unsupported` | Declared incapable. Absence by capability. |
| `unmeasured` | Not run. Absence by omission. |
| `medianMs` | Weighted median latency across the comparable set. Context, not score. |
| `weakest` | The lowest-passing feature with a real rejection example — what to fix first. |

## What this does not do

It does not tell you which stack to deploy. It tells you which comparisons the evidence supports,
which it does not, and what it would take to support the rest. At `n` between one and twelve, "not
separated at this n" is the most common honest verdict, and it is a result rather than a failure of
the tool.
