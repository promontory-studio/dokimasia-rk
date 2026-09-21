import { bucketRejection, DEFAULT_BUCKETS, type BucketTable } from "./buckets.ts";
import type { ProbeOutcome } from "./probe.ts";
import { wilson } from "./stats.ts";

export interface FeatureScore {
  feature: string;
  model: string;
  n: number;
  passed: number;
  /** null when n is 0. METHOD.md reserves zero for a feature that was asked and FAILED; a run that
   *  made no calls asked nothing, and every rate below is absent for the same reason. */
  passRate: number | null;
  /** Wilson interval on passRate. At n = 0 it is the full [0, 1] — what knowing nothing looks like. */
  ci: [number, number];
  /** Validated on the very first attempt, with no correction. The number that says whether the
   *  prompt lands on this model, as opposed to whether the retry loop can rescue it. */
  firstAttemptPassRate: number | null;
  /** Over every case, censored failures included — reported next to passRate, never instead of it. */
  meanAttempts: number | null;
  medianMs: number | null;
  /** Most common first, with one real example, because a flat result is only actionable if you can
   *  see WHAT the model got wrong. */
  rejections: { bucket: string; count: number; example: string }[];
}

export function summarize(
  outcomes: ProbeOutcome[],
  probe: { feature: string; attempts: number },
  buckets: BucketTable = DEFAULT_BUCKETS,
): FeatureScore {
  const n = outcomes.length;
  const passed = outcomes.filter((o) => o.ok).length;
  const first = outcomes.filter((o) => o.ok && o.attempts === 1).length;
  const ms = outcomes.map((o) => o.ms).sort((a, b) => a - b);
  const byBucket = new Map<string, { count: number; example: string }>();
  for (const o of outcomes) {
    for (const r of o.rejections) {
      const bucket = bucketRejection(r, buckets);
      const hit = byBucket.get(bucket);
      if (hit) hit.count++;
      else byBucket.set(bucket, { count: 1, example: r.slice(0, 200) });
    }
  }
  return {
    feature: probe.feature,
    model: outcomes[0]?.model ?? "",
    n,
    passed,
    passRate: n === 0 ? null : passed / n,
    ci: wilson(passed, n),
    firstAttemptPassRate: n === 0 ? null : first / n,
    meanAttempts: n === 0 ? null : outcomes.reduce((s, o) => s + o.attempts, 0) / n,
    medianMs: n === 0 ? null : (ms[Math.floor((n - 1) / 2)] ?? 0),
    rejections: [...byBucket].map(([bucket, v]) => ({ bucket, ...v })).sort((a, b) => b.count - a.count),
  };
}

/** A score from a run that actually made calls, so every rate is a number. The type a ranker needs:
 *  a feature with no calls behind it is unmeasured, and unmeasured never enters an average. */
export type MeasuredScore = FeatureScore & {
  passRate: number;
  firstAttemptPassRate: number;
  meanAttempts: number;
  medianMs: number;
};

export const measured = (s: FeatureScore): s is MeasuredScore => s.n > 0;
