// The corpus is only evidence if it reproduces and if its loops had something to iterate. Both are
// asserted here rather than trusted: a `for` over an empty array passes every assertion inside it,
// and a corpus that drifts between runs is an anecdote with a large n.
import { describe, expect, it } from "vitest";
import { buckets, censoring, coverage, ordering, runCorpus, separating, SEED, type CorpusSize } from "../benchmarks/arithmetic-corpus.ts";

// Small enough to run in a suite. Reproducibility is a property of the generator, not of its size.
const SMALL: CorpusSize = { coverageTrials: 200, pairs: 120, runs: 40 };

describe("the corpus reproduces", () => {
  it("returns identical results for identical seeds", () => {
    expect(runCorpus(SEED, SMALL)).toEqual(runCorpus(SEED, SMALL));
  });

  it("returns different results for a different seed, so the seed is actually the input", () => {
    expect(runCorpus(SEED + 1, SMALL)).not.toEqual(runCorpus(SEED, SMALL));
  });
});

describe("the corpus measured something", () => {
  it("covered every requested sample size", () => {
    const rows = coverage(200, [1, 5, 12]);
    expect(rows.map((r) => r.n)).toEqual([1, 5, 12]);
    for (const r of rows) expect(r.wilson).toBeGreaterThan(0);
  });

  it("found pairs to order and pairs to call ties", () => {
    const o = ordering(200, 12);
    const s = separating(120, 12);
    expect(o.pairs).toBeGreaterThan(100);
    expect(s.tiedPairs).toBeGreaterThan(100);
    expect(s.finite).toBeGreaterThan(0);
  });

  it("generated runs that differ in pass rate, so a mean-attempts collision means something", () => {
    const z = censoring(50, 12);
    expect(z.runs).toBe(50);
    expect(z.collisionsUncensored).toBeGreaterThan(0);
  });

  it("classified both transport faults and quality rejections", () => {
    const b = buckets();
    expect(b.transport).toBeGreaterThan(0);
    expect(b.messages - b.transport).toBeGreaterThan(0);
  });
});

describe("the rows discriminate", () => {
  // Each of these is the claim BENCHMARKS.md publishes. If the shipped rule were replaced by the
  // defensible alternative, the assertion below is the one that changes.
  it("keeps Wilson coverage near 95% where the normal approximation collapses", () => {
    const [one] = coverage(2_000, [1]);
    expect(one!.wilson).toBeGreaterThan(0.9);
    expect(one!.normal).toBeLessThan(0.05);
  });

  it("never prints an order it got wrong, where the point estimate does", () => {
    const o = ordering(500, 12);
    expect(o.separatedCorrect).toBe(o.separated);
    expect(o.pointWrong).toBeGreaterThan(0);
  });

  it("collides less on mean attempts than the uncensored alternative", () => {
    const z = censoring(150, 12);
    expect(z.collisionsCensored).toBeLessThan(z.collisionsUncensored);
  });

  it("reads no transport fault as a quality failure, where a domain-first table does", () => {
    const b = buckets();
    expect(b.misreadShipped).toBe(0);
    expect(b.misreadIfDomainFirst).toBeGreaterThan(0);
  });
});
