import { bucketRejection, DEFAULT_BUCKETS, type BucketTable } from "./buckets.ts";
import { censored, type ProbeOutcome } from "./probe.ts";
import { wilson } from "./stats.ts";

export interface FeatureScore {
  feature: string;
  model: string;
  n: number;
  passed: number;
  passRate: number;
  /** Wilson interval on passRate — the right interval at the small n a paid run can afford. */
  ci: [number, number];
  /** Validated on the very first attempt, with no correction. The number that says whether the
   *  prompt lands on this model, as opposed to whether the retry loop can rescue it. */
  firstAttemptPassRate: number;
  /** Over every case, censored failures included — reported next to passRate, never instead of it. */
  meanAttempts: number;
  medianMs: number;
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
    passRate: n === 0 ? 0 : passed / n,
    ci: wilson(passed, n),
    firstAttemptPassRate: n === 0 ? 0 : first / n,
    meanAttempts: n === 0 ? censored(probe) : outcomes.reduce((s, o) => s + o.attempts, 0) / n,
    medianMs: n === 0 ? 0 : (ms[Math.floor((n - 1) / 2)] ?? 0),
    rejections: [...byBucket].map(([bucket, v]) => ({ bucket, ...v })).sort((a, b) => b.count - a.count),
  };
}
