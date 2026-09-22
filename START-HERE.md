# Start here

Two ways in. Pick the one that sounds like you.

- **[A · You don't write code, and you're curious](#a--you-dont-write-code-and-youre-curious)** —
  three minutes, no code.
- **[B · You write code and want to see it work](#b--you-write-code-and-want-to-see-it-work)** —
  ten minutes, you'll run it.

Everything below either points at another document or translates one. Nothing is explained twice:
where this file would have to restate a mechanism, it links instead.

---

## A · You don't write code, and you're curious

### The problem, as a situation you have already had

A supplier quotes a better price on a component you buy by the thousand. Cheaper, allegedly
equivalent, available now. You swap it — and every product you build from it is now built on a part
nobody in your building has measured.

This is a solved problem, and it is worth being precise about *why* it is solved. The component has
a spec. You can put an arriving batch on a bench, measure it against that spec, and count how many
pass. Nobody has to argue about whether the new supplier is "good." You measure what you actually
need it to do.

Software built on a language model has the same problem and, at first glance, none of the solution.
The component is the model. Swapping it is one line in a configuration file — the cheapest-looking
edit in the codebase and the one with the widest blast radius, because it silently changes the
behaviour of every feature that calls it, by an amount nothing reports.

But the spec exists, and it is already written. Any program that shows a user something a model
produced has a moment where it decides whether the answer is usable at all: is this valid, does it
have a total, is that currency one we handle. That check is not an approximation of correctness —
it is the actual gate, because an answer it rejects is one no user ever sees. **This repo is the
bench.** It runs your own check, over your own cases, and counts.

One thing does not carry over from the component analogy, and it is the reason this is a library
rather than a spreadsheet. Measure a resistor twice and you get the same reading. Ask a model the
same question twice and you get two different answers, both plausible. So the honest output is never
a single number — it is a range, and the width of that range is set by how many cases you were
willing to pay for. When two candidate configurations' ranges overlap, this says *they overlap* and
tells you how many more cases it would take to tell them apart, rather than declaring a winner it
cannot support.

### What is actually in it

A small library that does three things, none of them clever.

**It runs your check, not its own.** Every other tool in this space brings its own idea of a good
answer — a rubric, a model grading another model, a reference answer to match. This one has none and
wants none. It borrows yours. That is also its biggest limitation: without a program that already
checks its own inputs, there is nothing here to use.

**It counts the way the software actually behaves.** If your code asks again when an answer is bad,
the measurement asks again too, because a feature that quietly retries twice is a feature that costs
three calls. And an answer that never became usable is recorded as worse than one that took every
retry and worked — otherwise "it eventually worked" and "it never worked" come out as the same
number.

**It reports what it does not know.** With twelve cases you cannot distinguish 92% from 79%, and the
main thing this library does is decline to pretend otherwise. [`BENCHMARKS.md`](BENCHMARKS.md) puts
a figure on that refusal, and it is not a flattering one.

### What it is not

- **Not a leaderboard, and not an opinion about models.** It never says a model is good. It says
  what happened when *your* software ran on it, over the cases you chose.
- **It cannot tell you a model was wrong** — only that your own software refused its answer. Those
  are different claims, and the smaller one is the one that can be proven.
- **It does not make anything better.** It changes no prompt and no output. It measures, and the
  only thing it produces is a number with a range attached.
- **It is not a test suite.** A test asserts something true on every run. Nothing here is true on
  every run; that is the whole problem, and it is why the answer is a rate rather than pass/fail.

### Six words, decoded

The rest of the documentation uses these freely.

| Word | In plain English |
|---|---|
| **probe** | One feature, plus the cases to run it on, plus your check. The unit everything else counts. [The real definition](README.md#what-this-is-for). |
| **oracle** | Whatever decides a given answer was acceptable. Here it is always your own shipped check — never a rubric, never a second model. |
| **case** | One input you committed to a file, so next quarter's run is the same run. |
| **attempt** | One call to the model. A feature that retries twice spends three attempts on a bad answer, and the number reported is the number paid for. |
| **censored** | The bookkeeping for a case that never worked: scored one past the maximum, so "used every retry and failed" cannot read as "used every retry and succeeded." [Why](ARCHITECTURE.md#4-load-bearing-invariants). |
| **stack** | A whole configuration — every feature's model, in the one file the application deploys. What you actually choose between; a model is not. |

### If you want the version written for engineers

[`README.md`](README.md) is the front page, and its first two sections make the same argument as
this one with none of the padding.

---

## B · You write code and want to see it work

### Ninety seconds, from clone to a real number

No key, no network, no account. Nothing in this repository can call a model — it constructs no
client and reads no key, and [`tests/packaging.test.ts`](tests/packaging.test.ts) fails the build if
that stops being true.

```console
$ npm install
$ npm test

 Test Files  9 passed (9)
      Tests  73 passed (73)
   Duration  1.57s
```

Now a whole assay, end to end — a shipped `extractInvoice` path with its own retry loop, its own
validator as the oracle, two features across two candidate configurations, every model reply coming
from a scripted table instead of a provider:

```console
$ node examples/offline-probe.ts
── per feature ──────────────────────────────────────────────────────────────
  feature "invoice" on frontier
    validated      11/12   92%   95% CI [0.65, 0.99]
    first try       75%
    mean attempts  1.42
    rejections     missing total ×2, invalid JSON ×1, unreachable ×1, bad currency ×1
                   e.g. attempt 1 rejected: missing field "total"
...
── per stack ────────────────────────────────────────────────────────────────
| # | stack | score (lower bound) | point | covered | not scored | median s | weakest |
|---|---|---|---|---|---|---|---|
| 1=local | frontier | 65% | 92% | 2/2 | — | 0.0 | invoice: missing total |
| 2=frontier | local | 51% | 79% | 2/2 | — | 0.0 | total: missing total |

ranked on 2 of 2 feature(s) — invoice, total — the only ones every stack was scored on; equal
weight per feature — itself a choice, stated rather than assumed Not separated at this n:
frontier / local. frontier vs local would need n≈113 per feature to separate.
```

That last line is the product. `frontier` validated 92% of cases and `local` 79%, and the ranking
still refuses to put one above the other — because at twelve cases per feature those two numbers are
one lucky case apart, and it says what it would take to be sure instead of guessing. Every unpleasant
thing about this output is the point of it: the `=` in both places, the gap between `score` and
`point`, and `n≈113` being nine times the run you just paid for.

The whole example is 190 lines of [`examples/offline-probe.ts`](examples/offline-probe.ts), and the
part worth reading is the top third — `validate()` is an ordinary function that throws, `extractInvoice`
is an ordinary retry loop, and neither knows it is being measured.

### Break it on purpose

[`ARCHITECTURE.md` § 4](ARCHITECTURE.md#4-load-bearing-invariants) argues that a case which never
validated must score `attempts + 1`, not `attempts`. That is one line and one character. Remove it:

```console
$ sed -i 's|^  return probe.attempts + 1;$|  return probe.attempts;|' probe.ts
$ npx vitest run tests/probe.test.ts

 FAIL  tests/probe.test.ts > runProbeCase > censors a case that never validated at one past the shipped ceiling
AssertionError: expected 4 to be 5 // Object.is equality

 FAIL  tests/probe.test.ts > runProbeCase > scores a probe with no correction channel at 2 when its single attempt failed
AssertionError: expected 1 to be 2 // Object.is equality

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```

Put it back (`git checkout probe.ts`). What the missing `+ 1` costs is not hypothetical:
[`BENCHMARKS.md` § 4](BENCHMARKS.md#4-censoring-at-attempts--1--1103-collisions-against-2398)
counts it — without it, more than twice as many pairs of runs with genuinely different pass rates
report the identical mean-attempts number.

### Then read, in this order

| Read | Time | For |
|---|---|---|
| [`README.md` § *What this is for*](README.md#what-this-is-for) | 2 min | what a probe is, and the four parts it takes to run one |
| [`ARCHITECTURE.md` § 2](ARCHITECTURE.md#2-probes-live-with-validators-not-with-the-harness) | 5 min | why your probe belongs in your repo and not this one — the seam the whole design turns on |
| [`METHOD.md`](METHOD.md) | 5 min | what a published number has to survive, and why a paid run is pre-registered before it is paid for |
| [`RANKING.md`](RANKING.md) | 8 min | the six rules behind that table, each one because the obvious implementation is dishonest |
| [`BENCHMARKS.md`](BENCHMARKS.md) | 5 min | the arithmetic measured against known true rates, including the two rows where it comes off badly |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 3 min | the anti-vacuity rule the suite holds itself to |

### The one thing that is not obvious

The instinct on seeing this is that it is an eval framework, and the right question is why promptfoo
or Inspect would not simply do it. They are genuinely better at what they do than the code here —
and they are better because of a capability this deliberately refuses.

Every one of them can grade a response, because every one of them brought its own notion of correct:
a rubric, a reference answer, a judge model. That is what makes them usable on a model you know
nothing about, and it is also what makes their number a number about *their* notion of correct. This
package cannot grade anything. It has no opinion about any response and no way to acquire one. It
can only ask your application whether it would have accepted this, and count the answers.

Which is why the awkward consequence is not an oversight: **a probe cannot live in this
repository.** The oracle is the validator, the validator lives with the domain, so the probe lives
with the domain too — and this package stays a spine that can never demonstrate itself alone. That
trade is argued in [`ARCHITECTURE.md` § 2](ARCHITECTURE.md#2-probes-live-with-validators-not-with-the-harness),
and its unpaid bill is the first item under
[*What this does not claim*](README.md#what-this-does-not-claim).
