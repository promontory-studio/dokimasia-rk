// One comparable verdict per STACK — a whole configuration, scored across its features — so a
// deployer picks between configurations instead of reading four per-feature tables side by side.
//
// Every rule below exists because the obvious implementation is dishonest at the n a paid run can
// afford. RANKING.md states them in prose; this file is where each one is enforced, and tests/
// rank.test.ts is where each one is red if it is removed.
import { measured, type FeatureScore, type MeasuredScore } from "./score.ts";
import { wilson } from "./stats.ts";

export type StackWeights = Record<string, number>;

export interface StackEntry {
  stack: string;
  scores: FeatureScore[];
  /** Features this stack DECLARED it cannot serve. Absence by capability, not by failure — a
   *  feature listed here was never called, so scoring it zero would be a measurement nobody made. */
  unsupported?: string[];
}

export interface StackVerdict {
  stack: string;
  /** Of the features asked for: served and measured / asked. Reported, never folded into `score`. */
  covered: number;
  total: number;
  unsupported: string[];
  /** Asked for, not declared unsupported, and still has no score — a run that did not happen. */
  unmeasured: string[];
  /** Weighted mean of Wilson LOWER bounds over the comparable set. The ordering key. */
  score: number;
  /** Weighted mean of point estimates. Printed beside `score`, never used to order. */
  point: number;
  /** Weighted mean of Wilson UPPER bounds. Only used to decide whether two stacks separated. */
  ceiling: number;
  /** Slowest-case context, reported beside the score and never inside it. */
  medianMs: number;
  weakest?: { feature: string; bucket: string; example: string };
}

export interface Ranking {
  /** The features EVERY ranked stack could be scored on. Ranking happens here and nowhere else. */
  comparable: string[];
  ranked: StackVerdict[];
  /** Unordered pairs whose intervals overlap: not separated at this n. */
  ties: [string, string][];
  note: string;
}

const weightOf = (feature: string, weights?: StackWeights): number => weights?.[feature] ?? 1;

// Deliberately has no empty case. A mean of nothing is not zero, and returning zero here is what
// once printed two 12/12 stacks as a 0% tie underneath the note saying nothing was ranked.
function mean(values: [number, number][]): number {
  const total = values.reduce((s, [, w]) => s + w, 0);
  if (total === 0) throw new Error("mean of no measurements — an unmeasured feature is not a zero");
  return values.reduce((s, [v, w]) => s + v * w, 0) / total;
}

/** The smallest n at which two proportions this far apart would stop overlapping — what it would
 *  take to separate them, assuming the observed rates hold. Infinity when they never would. */
export function separatingN(a: number, b: number, limit = 10_000): number {
  if (a === b) return Infinity;
  for (let n = 1; n <= limit; n++) {
    const [aLo, aHi] = wilson(Math.round(a * n), n);
    const [bLo, bHi] = wilson(Math.round(b * n), n);
    if (aLo > bHi || bLo > aHi) return n;
  }
  return Infinity;
}

function verdict(entry: StackEntry, features: string[], comparable: string[], weights?: StackWeights): StackVerdict {
  const byFeature = new Map(entry.scores.filter(measured).map((s) => [s.feature, s]));
  const unsupported = features.filter((f) => entry.unsupported?.includes(f));
  const unmeasured = features.filter((f) => !unsupported.includes(f) && !byFeature.has(f));
  const scored = comparable.map((f) => byFeature.get(f)).filter((s): s is MeasuredScore => s !== undefined);

  // Drawn from `scored`, not from every score the stack has: the column sits beside a mean taken
  // over the comparable set alone, and a weakest from outside it names a feature that contributed
  // nothing to the number. Ordered on the lower bound, because rule 1 orders on the lower bound.
  const weakest = scored
    .filter((s) => s.rejections.length > 0)
    .sort((a, b) => a.ci[0] - b.ci[0])[0];

  return {
    stack: entry.stack,
    covered: features.length - unsupported.length - unmeasured.length,
    total: features.length,
    unsupported,
    unmeasured,
    score: mean(scored.map((s) => [s.ci[0], weightOf(s.feature, weights)])),
    point: mean(scored.map((s) => [s.passRate, weightOf(s.feature, weights)])),
    ceiling: mean(scored.map((s) => [s.ci[1], weightOf(s.feature, weights)])),
    medianMs: mean(scored.map((s) => [s.medianMs, weightOf(s.feature, weights)])),
    ...(weakest?.rejections[0]
      ? { weakest: { feature: weakest.feature, bucket: weakest.rejections[0].bucket, example: weakest.rejections[0].example } }
      : {}),
  };
}

/**
 * Rank whole stacks on the features ALL of them could be scored on.
 *
 * The intersection is the load-bearing choice. A mean over stack A's four features against a mean
 * over stack B's two different features compares nothing, and lets a stack win by declaring less
 * capability. Coverage is reported beside the score instead, where a reader can weigh it.
 */
export function rankStacks(entries: StackEntry[], opts: { features: string[]; weights?: StackWeights }): Ranking {
  const { features, weights } = opts;
  // A feature present in `scores` but with n = 0 was never run, so it is not common ground.
  const scoredIn = (e: StackEntry) => new Set(e.scores.filter(measured).map((s) => s.feature));
  const comparable = features.filter((f) => entries.every((e) => scoredIn(e).has(f)));

  // Nothing comparable means nothing to rank, and RANKING.md is explicit that an order would not be
  // correct output here. The note carries the whole answer; no verdict is constructed at all.
  const ranked = comparable.length
    ? entries.map((e) => verdict(e, features, comparable, weights)).sort((a, b) => b.score - a.score)
    : [];

  const ties: [string, string][] = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const a = ranked[i]!;
      const b = ranked[j]!;
      if (a.score <= b.ceiling && b.score <= a.ceiling) ties.push([a.stack, b.stack]);
    }
  }

  const weighting = weights
    ? `weighted ${Object.entries(weights).map(([f, w]) => `${f}×${w}`).join(", ")}`
    : "equal weight per feature — itself a choice, stated rather than assumed";
  const scope =
    comparable.length === 0
      ? "NOTHING IS RANKED: no feature was scored on every stack, so no two of these are comparable."
      : `ranked on ${comparable.length} of ${features.length} feature(s) — ${comparable.join(", ")} — the only ones every stack was scored on; ${weighting}`;
  const tieNote = ties.length
    ? ` Not separated at this n: ${ties.map(([a, b]) => `${a} / ${b}`).join("; ")}. ` +
      ties
        .map(([a, b]) => {
          const av = ranked.find((r) => r.stack === a)!;
          const bv = ranked.find((r) => r.stack === b)!;
          const n = separatingN(av.point, bv.point);
          return `${a} vs ${b} would need n≈${n === Infinity ? "∞ (identical rates)" : n} per feature to separate`;
        })
        .join("; ") + "."
    : "";

  return { comparable, ranked, ties, note: scope + tieNote };
}

export function rankingTable(r: Ranking): string {
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const rows = r.ranked.map((v, i) => {
    // The partners are named, not just marked. Overlap is not transitive (RANKING.md:70), so a bare
    // `=` on a tying b and b tying c reads as a three-way tie that the intervals do not support.
    const partners = r.ranked
      .filter((o) => r.ties.some(([a, b]) => (a === v.stack && b === o.stack) || (b === v.stack && a === o.stack)))
      .map((o) => o.stack);
    const place = partners.length ? `${i + 1}=${partners.join(",")}` : `${i + 1}`;
    const gaps = [
      v.unsupported.length ? `${v.unsupported.length} unsupported` : "",
      v.unmeasured.length ? `${v.unmeasured.length} unmeasured` : "",
    ].filter(Boolean).join(", ") || "—";
    const weak = v.weakest ? `${v.weakest.feature}: ${v.weakest.bucket}` : "—";
    return `| ${place} | ${v.stack} | ${pct(v.score)} | ${pct(v.point)} | ${v.covered}/${v.total} | ${gaps} | ${(v.medianMs / 1000).toFixed(1)} | ${weak} |`;
  });
  return [
    "| # | stack | score (lower bound) | point | covered | not scored | median s | weakest |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    r.note,
  ].join("\n");
}
