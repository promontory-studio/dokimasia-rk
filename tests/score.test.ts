import { describe, expect, it } from "vitest";
import { summarize } from "../score.ts";
import { withDefaults, type BucketTable } from "../buckets.ts";
import type { ProbeOutcome } from "../probe.ts";

const outcome = (o: Partial<ProbeOutcome> & { ok: boolean; attempts: number }): ProbeOutcome => ({
  feature: "f",
  model: "m",
  label: "case",
  rejections: [],
  ms: 100,
  ...o,
});

const probe = { feature: "f", attempts: 4 };

describe("summarize", () => {
  it("reports pass rate, first-attempt rate and censored mean attempts as three different numbers", () => {
    const s = summarize(
      [
        outcome({ ok: true, attempts: 1 }),
        outcome({ ok: true, attempts: 3, rejections: ["missing field", "missing field"] }),
        outcome({ ok: false, attempts: 5, rejections: ["a", "b", "c", "d"] }),
      ],
      probe,
    );
    expect(s.n).toBe(3);
    expect(s.passed).toBe(2);
    expect(s.passRate).toBeCloseTo(2 / 3);
    // Only ONE case landed without correction; the retry loop rescued the other.
    expect(s.firstAttemptPassRate).toBeCloseTo(1 / 3);
    // (1 + 3 + 5) / 3 — the failure enters at the censored value, not at the ceiling.
    expect(s.meanAttempts).toBeCloseTo(3);
  });

  // METHOD.md: zero is reserved for a feature that was asked and FAILED. A run that made no calls
  // asked nothing, so every rate-shaped field is absent rather than zero — and the interval stays
  // the full [0, 1], which is what knowing nothing looks like.
  it("reports an empty run as unmeasured, not as a zero", () => {
    const s = summarize([], probe);
    expect(s.n).toBe(0);
    expect(s.passed).toBe(0);
    expect(s.passRate).toBeNull();
    expect(s.firstAttemptPassRate).toBeNull();
    expect(s.meanAttempts).toBeNull();
    expect(s.medianMs).toBeNull();
    expect(s.ci).toEqual([0, 1]);
  });

  it("keeps a clean sweep's interval below 1 instead of claiming certainty", () => {
    const s = summarize([outcome({ ok: true, attempts: 1 })], probe);
    expect(s.passRate).toBe(1);
    expect(s.ci[1]).toBe(1);
    expect(s.ci[0]).toBeLessThan(0.5);
  });

  it("orders rejection buckets by count and keeps one real example of each", () => {
    const domain: BucketTable = withDefaults([["missing field", /missing /]]);
    const s = summarize(
      [
        outcome({ ok: false, attempts: 5, rejections: ["missing field x", "missing field y", "fetch failed"] }),
        outcome({ ok: false, attempts: 5, rejections: ["missing field z"] }),
      ],
      probe,
      domain,
    );
    expect(s.rejections[0]).toMatchObject({ bucket: "missing field", count: 3 });
    expect(s.rejections[0]!.example).toBe("missing field x");
    expect(s.rejections[1]).toMatchObject({ bucket: "unreachable", count: 1 });
  });

  it("takes the median second, not the mean, so one 300 s timeout does not set the number", () => {
    const s = summarize(
      [outcome({ ok: true, attempts: 1, ms: 1000 }), outcome({ ok: true, attempts: 1, ms: 2000 }), outcome({ ok: true, attempts: 1, ms: 300_000 })],
      probe,
    );
    expect(s.medianMs).toBe(2000);
  });
});
