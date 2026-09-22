# Method — the discipline a measured number has to survive

This page owns the rules. A consumer's own contributor guide should link here rather than restate
them; a rule that exists in two places drifts, and then one of the copies is a lie with no signal
which.

## One page owns the numbers

Every measured figure goes on one page in the consuming repo — with the date, the `n`, and the
configuration it came from — and nowhere else. A number repeated in a README, a slide and a
changelog is three numbers as soon as one of them is updated.

This repo's own arithmetic obeys the same rule against itself: the rows that can be settled offline
with no model live on [`BENCHMARKS.md`](BENCHMARKS.md) and nowhere else, so a consuming page and
this one cannot drift into contradicting each other.

**A result that came back flat or negative is published unchanged.** A ledger that only records
wins is not evidence of anything. This is the rule that costs something, and it is the reason the
rest of the page is worth reading.

## Pre-register a sampled run before paying for it

A sampled run issues real calls and costs real money, which is exactly the condition under which
the temptation to decide what counts as a result *after* seeing the numbers is strongest. Deciding
afterwards is how a benchmark becomes decoration.

Recorded before the first call, and printed by the run's own `--preview`:

- **The claim under test**, in the words it was originally made in.
- **The oracle** — which `validate()` decides a pass, named explicitly.
- **The outcome measures**, and which direction is better.
- **The cases**, and where they are committed.
- **The `n`, the regime, and the minimum detectable effect.** `minimumDetectableWins(n)` returning
  `Infinity` means this run cannot produce a significant result and should be resized or reported
  as descriptive before it is paid for.
- **What each outcome will mean** — including what a flat result will mean, written down while a
  flat result is still a live possibility.
- **What is not measured**, so absence is reported as absence rather than read as a pass.

`PreRegistration` and `renderPreRegistration` exist so this is a value rather than a block of prose
that can quietly diverge from the page that quotes it. When the consuming page asserts that its
registration block equals the render, the claim "the preview prints this same text" becomes true by
construction instead of true until someone edits one of them.

## Four rules for a published row

These are what the page is worth.

- **A row measures the claim it is filed under, in that claim's own units.** A number that is easy
  to compute is not a substitute for the one the sentence actually makes. If the claim is about
  output changing, the row has to compute outputs.
- **A row must be able to come out differently for an implementation that is correct but
  different** — and you must be able to name what that implementation would score. This is stricter
  than mutation testing: breaking the code and watching a number move proves the row *reads* the
  code, not that it *discriminates*. A row with no such answer is a tautology, and a tautology
  reporting 100% is worse than no row at all.
- **Publish the interpretation next to the number.** A rate with no stated meaning gets read as
  whichever meaning flatters the author, and the same figure carries opposite meanings in adjacent
  rows. Say what the number is measured against and what it costs the reader — one sentence, in the
  domain's own nouns, separate from the measurement itself.
- **Report absence as absence.** A feature the configuration declares it cannot serve is
  `unsupported`; a feature that was not run is `unmeasured`. Neither is a zero. A zero is a thing
  that was asked and failed.

## Reconciled is not gated

Where a page's figures are checked against a live run, the check asks whether the page matches the
run — never whether the run is good enough. **No rate is gated on a threshold.** Several rates are
*expected* to move when the code does, and a threshold turns an honest measurement into something
to be managed.

## Operational honesty

Two failure modes account for most benchmark numbers that are wrong rather than merely noisy.

**A model that was never asked reading as a model that answers badly.** A connection reset, an
empty credit balance, a rate limit and a bad key are not opinions about a model's quality. They are
bucketed first, ahead of every quality reason, and they are visible in the output as their own
categories. See [`ARCHITECTURE.md`](ARCHITECTURE.md) §4.

**A ceiling failure indistinguishable from a last-attempt success.** A shipped path that retries
three times and fails records `4`, not `3`. Without that, "used every attempt and succeeded" and
"used every attempt and never succeeded" are the same number.

## Interpreting a small `n`

At the `n` a paid run affords, the honest default is that most differences are not separable.

- Report the interval, not just the rate. A `12/12` is `[0.76, 1.00]`, and the left end of that is
  the part a deployer needs.
- Order on the lower bound; print the point estimate beside it. See [`RANKING.md`](RANKING.md).
- When two intervals overlap, say so and say what `n` would separate them. An order printed between
  two indistinguishable configurations is decoration.
