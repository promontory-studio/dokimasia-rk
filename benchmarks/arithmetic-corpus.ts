// The arithmetic in this package is a pure function over outcomes, so its claims can be settled
// exactly instead of sampled: generate runs whose TRUE pass rates are known, replay them through
// the shipped functions, and check the answer against the generating probabilities rather than
// against the code under test.
//
//   node benchmarks/arithmetic-corpus.ts     (Node >= 23.6; plain Node 22 needs --experimental-strip-types)
//
// No key, no network, no model. Every row below names the correct-but-different implementation it
// discriminates against, because a row that only goes red when the code is broken proves the row
// READS the code, not that it tells two defensible implementations apart — METHOD.md, rule 2.
import { bucketRejection, withDefaults, DEFAULT_BUCKETS, type BucketTable } from "../buckets.ts";
import type { ProbeOutcome } from "../probe.ts";
import { rankStacks, separatingN } from "../rank.ts";
import { summarize, type FeatureScore } from "../score.ts";
import { wilson } from "../stats.ts";

export const SEED = 20260921;

/** mulberry32. Named because the seed is the reproduction instruction: a corpus you cannot re-run
 *  bit for bit is an anecdote with a large n. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const draw = (next: () => number, p: number, n: number): number => {
  let k = 0;
  for (let i = 0; i < n; i++) if (next() < p) k++;
  return k;
};

/** The textbook interval this package refuses. Implemented here, not shipped: it is the thing the
 *  coverage row discriminates against, and it has to be real to be measured. */
function normalApprox(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const half = z * Math.sqrt((p * (1 - p)) / n);
  return [p - half, p + half];
}

const contains = ([lo, hi]: [number, number], p: number): boolean => lo <= p && p <= hi;

// ─── row 1 · does a 95% interval contain the true rate 95% of the time? ─────────────────────────

export interface Coverage {
  n: number;
  wilson: number;
  normal: number;
  normalDegenerate: number;
}

export function coverage(trials: number, sizes: number[], seed = SEED): Coverage[] {
  const next = rng(seed);
  return sizes.map((n) => {
    let w = 0;
    let g = 0;
    let degenerate = 0;
    for (let t = 0; t < trials; t++) {
      const p = next();
      const k = draw(next, p, n);
      if (contains(wilson(k, n), p)) w++;
      const normal = normalApprox(k, n);
      if (contains(normal, p)) g++;
      if (normal[0] === normal[1]) degenerate++;
    }
    return { n, wilson: w / trials, normal: g / trials, normalDegenerate: degenerate / trials };
  });
}

// ─── shared · a stack whose true rates are known ────────────────────────────────────────────────

const FEATURES = ["alpha", "beta", "gamma"];
const ATTEMPTS = 3;

function outcomesFor(next: () => number, feature: string, model: string, p: number, n: number): ProbeOutcome[] {
  return Array.from({ length: n }, (_, i) => {
    const ok = next() < p;
    const attempts = ok ? 1 + Math.floor(next() * ATTEMPTS) : ATTEMPTS + 1;
    return {
      feature,
      model,
      label: `${feature}-${i}`,
      ok,
      attempts,
      rejections: ok ? [] : ['attempt 1 rejected: missing field "unit"'],
      ms: 1000,
    };
  });
}

const scoresFor = (next: () => number, model: string, rates: number[], n: number): FeatureScore[] =>
  FEATURES.map((feature, i) => summarize(outcomesFor(next, feature, model, rates[i]!, n), { feature, attempts: ATTEMPTS }));

/** The mean true rate is the ground truth the ranking is graded against — taken from the
 *  generating probabilities, never from anything the harness computed. */
const trueMean = (rates: number[]): number => rates.reduce((s, r) => s + r, 0) / rates.length;

// ─── row 2 · ordering on the lower bound, and what it costs ─────────────────────────────────────

export interface Ordering {
  pairs: number;
  separated: number;
  separatedCorrect: number;
  pointAlwaysPrints: number;
  pointWrong: number;
  /** Pairs whose true means are at least a quarter apart — the ones a deployer would call an
   *  obvious difference — and how many of those the harness was willing to order. */
  wideGap: number;
  wideGapSeparated: number;
}

export function ordering(pairs: number, n: number, seed = SEED + 1): Ordering {
  const next = rng(seed);
  let separated = 0;
  let separatedCorrect = 0;
  let pointWrong = 0;
  let compared = 0;
  let wideGap = 0;
  let wideGapSeparated = 0;

  for (let t = 0; t < pairs; t++) {
    const aRates = FEATURES.map(() => 0.4 + next() * 0.6);
    const bRates = FEATURES.map(() => 0.4 + next() * 0.6);
    if (trueMean(aRates) === trueMean(bRates)) continue;
    compared++;

    const entries = [
      { stack: "a", scores: scoresFor(next, "a", aRates, n) },
      { stack: "b", scores: scoresFor(next, "b", bRates, n) },
    ];
    const ranking = rankStacks(entries, { features: FEATURES });
    const better = trueMean(aRates) > trueMean(bRates) ? "a" : "b";
    const wide = Math.abs(trueMean(aRates) - trueMean(bRates)) >= 0.25;
    if (wide) wideGap++;

    // What the harness prints as an order: only the pairs it did not call a tie.
    if (ranking.ties.length === 0) {
      separated++;
      if (wide) wideGapSeparated++;
      if (ranking.ranked[0]!.stack === better) separatedCorrect++;
    }
    // The counterfactual: print an order every time, taken from the point estimates.
    const byPoint = [...ranking.ranked].sort((x, y) => y.point - x.point);
    if (byPoint[0]!.stack !== better) pointWrong++;
  }

  return { pairs: compared, separated, separatedCorrect, pointAlwaysPrints: compared, pointWrong, wideGap, wideGapSeparated };
}

// ─── row 3 · does separatingN's n actually separate? ────────────────────────────────────────────

export interface Separating {
  tiedPairs: number;
  finite: number;
  separatedOnRerun: number;
  medianN: number;
  /** The n the TRUE rates would have needed. Larger than the named n means the observed gap that
   *  produced the promise was the noise, not the signal. */
  medianTrueN: number;
}

export function separating(pairs: number, n: number, seed = SEED + 2): Separating {
  const next = rng(seed);
  const named: number[] = [];
  const truth: number[] = [];
  let tied = 0;
  let separatedOnRerun = 0;

  for (let t = 0; t < pairs; t++) {
    const aRates = FEATURES.map(() => 0.4 + next() * 0.6);
    const bRates = FEATURES.map(() => 0.4 + next() * 0.6);
    const ranking = rankStacks(
      [
        { stack: "a", scores: scoresFor(next, "a", aRates, n) },
        { stack: "b", scores: scoresFor(next, "b", bRates, n) },
      ],
      { features: FEATURES },
    );
    if (ranking.ties.length === 0) continue;
    tied++;

    const [x, y] = ranking.ranked;
    const promised = separatingN(x!.point, y!.point);
    if (!Number.isFinite(promised)) continue;
    named.push(promised);
    truth.push(separatingN(trueMean(aRates), trueMean(bRates)));

    // Re-run at the n it named — with fresh draws from the TRUE rates, not by replaying the
    // observed ones, which would separate by construction and prove nothing.
    const rerun = rankStacks(
      [
        { stack: "a", scores: scoresFor(next, "a", aRates, promised) },
        { stack: "b", scores: scoresFor(next, "b", bRates, promised) },
      ],
      { features: FEATURES },
    );
    if (rerun.ties.length === 0) separatedOnRerun++;
  }

  const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  };
  return { tiedPairs: tied, finite: named.length, separatedOnRerun, medianN: median(named), medianTrueN: median(truth) };
}

// ─── row 4 · censoring, and what collapses without it ───────────────────────────────────────────

export interface Censoring {
  runs: number;
  collisionsCensored: number;
  collisionsUncensored: number;
}

/** Two runs with different pass rates that report the same mean attempts are indistinguishable in
 *  the column a reader compares. Counting those collisions prices the +1. */
export function censoring(runs: number, n: number, seed = SEED + 3): Censoring {
  const next = rng(seed);
  const rows = Array.from({ length: runs }, () => {
    const p = next();
    const outcomes = outcomesFor(next, "alpha", "m", p, n);
    const passed = outcomes.filter((o) => o.ok).length;
    const total = (censor: number) => outcomes.reduce((s, o) => s + (o.ok ? o.attempts : censor), 0) / n;
    return { passed, censored: total(ATTEMPTS + 1), uncensored: total(ATTEMPTS) };
  });

  const collide = (pick: (r: (typeof rows)[number]) => number): number => {
    let hits = 0;
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++)
        if (rows[i]!.passed !== rows[j]!.passed && Math.abs(pick(rows[i]!) - pick(rows[j]!)) < 1e-9) hits++;
    return hits;
  };

  return { runs, collisionsCensored: collide((r) => r.censored), collisionsUncensored: collide((r) => r.uncensored) };
}

// ─── row 5 · bucket order ───────────────────────────────────────────────────────────────────────

export interface Buckets {
  messages: number;
  transport: number;
  misreadShipped: number;
  misreadIfDomainFirst: number;
  qualityAgreement: number;
}

const DOMAIN: BucketTable = [
  ["missing unit", /missing field "unit"/],
  ["unknown group", /not one of the groups/],
];

/** A transport fault carrying the retry's quality text is the case that decides the order — a real
 *  message, from a run whose connection dropped mid-correction. */
export function buckets(seed = SEED + 4): Buckets {
  const next = rng(seed);
  const transport = [
    'fetch failed while retrying: missing field "unit"',
    'socket hang up after: not one of the groups offered',
    "ECONNREFUSED",
    "503 from upstream",
  ];
  const quality = ['missing field "unit"', "not one of the groups offered", "invalid JSON in response", "no text block"];

  const shipped = withDefaults(DOMAIN);
  const domainFirst: BucketTable = [...DOMAIN, ...DEFAULT_BUCKETS];
  const sample = Array.from({ length: 200 }, () => {
    const isTransport = next() < 0.5;
    const pool = isTransport ? transport : quality;
    return { isTransport, message: pool[Math.floor(next() * pool.length)]! };
  });

  let misreadShipped = 0;
  let misreadIfDomainFirst = 0;
  let qualityAgreement = 0;
  for (const { isTransport, message } of sample) {
    const a = bucketRejection(message, shipped);
    const b = bucketRejection(message, domainFirst);
    if (isTransport) {
      if (a !== "unreachable") misreadShipped++;
      if (b !== "unreachable") misreadIfDomainFirst++;
    } else if (a === b) qualityAgreement++;
  }

  return {
    messages: sample.length,
    transport: sample.filter((s) => s.isTransport).length,
    misreadShipped,
    misreadIfDomainFirst,
    qualityAgreement,
  };
}

// ─── the run ────────────────────────────────────────────────────────────────────────────────────

export interface Corpus {
  seed: number;
  coverage: Coverage[];
  ordering: Ordering;
  separating: Separating;
  censoring: Censoring;
  buckets: Buckets;
}

/** How much corpus to generate. Published rows use `FULL`; a test asserting that the generator is
 *  seeded needs the property, not the sample size, and says so by passing a smaller one. */
export interface CorpusSize {
  coverageTrials: number;
  pairs: number;
  runs: number;
}

export const FULL: CorpusSize = { coverageTrials: 20_000, pairs: 2_000, runs: 300 };

/** The n every published row is measured at: what a paid run of twelve cases per feature affords. */
export const CASES_PER_FEATURE = 12;

export function runCorpus(seed = SEED, size: CorpusSize = FULL): Corpus {
  return {
    seed,
    coverage: coverage(size.coverageTrials, [1, 5, CASES_PER_FEATURE], seed),
    ordering: ordering(size.pairs, CASES_PER_FEATURE, seed + 1),
    separating: separating(size.pairs, CASES_PER_FEATURE, seed + 2),
    censoring: censoring(size.runs, CASES_PER_FEATURE, seed + 3),
    buckets: buckets(seed + 4),
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function report(c: Corpus): string {
  const { ordering: o, separating: s, censoring: z, buckets: b } = c;
  return [
    `seed ${c.seed} — every figure below reproduces exactly from it`,
    "",
    "1. interval coverage — how often a 95% interval contains the true rate",
    "   n    wilson    normal approx    normal is a point",
    ...c.coverage.map(
      (r) => `   ${String(r.n).padStart(2)}   ${pct(r.wilson).padStart(6)}    ${pct(r.normal).padStart(6)}           ${pct(r.normalDegenerate).padStart(6)}`,
    ),
    "",
    `2. ordering on the lower bound — ${o.pairs} pairs with genuinely different true rates, n=12`,
    `   printed an order        ${o.separated} of ${o.pairs} (${pct(o.separated / o.pairs)})`,
    `   ...and it was right     ${o.separatedCorrect} of ${o.separated} (${pct(o.separatedCorrect / Math.max(o.separated, 1))})`,
    `   counterfactual: order on the point estimate, always printed`,
    `   ...wrong                ${o.pointWrong} of ${o.pointAlwaysPrints} (${pct(o.pointWrong / o.pointAlwaysPrints)})`,
    `   of the ${o.wideGap} pairs a quarter apart, it ordered ${o.wideGapSeparated} (${pct(o.wideGapSeparated / Math.max(o.wideGap, 1))})`,
    "",
    `3. separatingN's promise — ${s.tiedPairs} tied pairs, ${s.finite} named a finite n (median ${s.medianN})`,
    `   the n the TRUE rates needed          median ${s.medianTrueN}`,
    `   separated on a fresh run at that n   ${s.separatedOnRerun} of ${s.finite} (${pct(s.separatedOnRerun / Math.max(s.finite, 1))})`,
    "",
    `4. censoring at attempts+1 — ${z.runs} runs at n=12, pairs differing in pass rate that share a mean-attempts`,
    `   censored (shipped)      ${z.collisionsCensored}`,
    `   uncensored              ${z.collisionsUncensored}`,
    "",
    `5. bucket order — ${b.messages} rejections, ${b.transport} of them transport faults`,
    `   misread as quality, defaults first (shipped)   ${b.misreadShipped}`,
    `   misread as quality, domain table first         ${b.misreadIfDomainFirst}`,
    `   agreement on the non-transport rejections      ${b.qualityAgreement} of ${b.messages - b.transport}`,
  ].join("\n");
}

if (import.meta.filename === process.argv[1]) console.log(report(runCorpus()));
