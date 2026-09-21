// One test per rule in RANKING.md. Each of these is red if its rule is removed from rank.ts — that
// is the point of writing them: the obvious implementation of a ranker passes none of them.
import { describe, expect, it } from "vitest";
import { rankingTable, rankStacks, separatingN } from "../rank.ts";
import { summarize } from "../score.ts";
import type { ProbeOutcome } from "../probe.ts";
import type { FeatureScore } from "../score.ts";

/** A FeatureScore from a pass count, built through summarize so the intervals are the real ones. */
function scoreOf(feature: string, passed: number, n: number, ms = 1000): FeatureScore {
  const outcomes: ProbeOutcome[] = Array.from({ length: n }, (_, i) => ({
    feature,
    model: "m",
    label: `c${i}`,
    ok: i < passed,
    attempts: i < passed ? 1 : 2,
    rejections: i < passed ? [] : ["missing field \"unit\""],
    ms,
  }));
  return summarize(outcomes, { feature, attempts: 1 });
}

describe("rule 1 — rank on the interval's lower bound, never the point estimate", () => {
  it("does not let a 1/1 stack outrank an 11/12 stack", () => {
    const r = rankStacks(
      [
        { stack: "lucky", scores: [scoreOf("ranges", 1, 1)] },
        { stack: "measured", scores: [scoreOf("ranges", 11, 12)] },
      ],
      { features: ["ranges"] },
    );
    // Both are 100% and 92% by point estimate, which would put "lucky" first.
    expect(r.ranked[0]!.point).toBeLessThan(r.ranked[1]!.point);
    expect(r.ranked[0]!.stack).toBe("measured");
  });

  it("still reports the point estimate, so the contrast is visible", () => {
    const r = rankStacks([{ stack: "a", scores: [scoreOf("ranges", 1, 1)] }], { features: ["ranges"] });
    expect(r.ranked[0]!.point).toBe(1);
    expect(r.ranked[0]!.score).toBeLessThan(1);
  });
});

describe("rule 2 — coverage is not quality", () => {
  it("ranks on the features every stack was scored on, so declaring less cannot win", () => {
    const narrow = { stack: "narrow", scores: [scoreOf("ranges", 12, 12)], unsupported: ["extract"] };
    const broad = { stack: "broad", scores: [scoreOf("ranges", 12, 12), scoreOf("extract", 6, 12)] };
    const r = rankStacks([narrow, broad], { features: ["ranges", "extract"] });

    // "extract" is not in the comparable set, so narrow's perfect ranges score does not get to
    // beat broad by simply having no second feature to be bad at.
    expect(r.comparable).toEqual(["ranges"]);
    expect(r.ranked[0]!.score).toBeCloseTo(r.ranked[1]!.score);
    expect(r.note).toContain("ranked on 1 of 2");
  });

  it("reports the capability gap as coverage rather than hiding it", () => {
    const r = rankStacks(
      [{ stack: "narrow", scores: [scoreOf("ranges", 12, 12)], unsupported: ["extract"] }],
      { features: ["ranges", "extract"] },
    );
    expect(r.ranked[0]).toMatchObject({ covered: 1, total: 2, unsupported: ["extract"] });
  });

  // RANKING.md: "That is the correct output; an order would not be." The note alone is not enough —
  // both stacks below went 12/12, and an earlier implementation printed them as a 0% tie underneath
  // the very note that says nothing is ranked.
  it("ranks nothing, and says so, when no feature was scored on every stack", () => {
    const r = rankStacks(
      [
        { stack: "a", scores: [scoreOf("ranges", 12, 12)] },
        { stack: "b", scores: [scoreOf("extract", 12, 12)] },
      ],
      { features: ["ranges", "extract"] },
    );
    expect(r.comparable).toEqual([]);
    expect(r.note).toContain("NOTHING IS RANKED");
    expect(r.ranked).toEqual([]);
    expect(r.ties).toEqual([]);
  });

  it("prints no row, and invents no percentage, when nothing is comparable", () => {
    const r = rankStacks(
      [
        { stack: "a", scores: [scoreOf("ranges", 12, 12)] },
        { stack: "b", scores: [scoreOf("extract", 12, 12)] },
      ],
      { features: ["ranges", "extract"] },
    );
    const table = rankingTable(r);
    expect(table).toContain("NOTHING IS RANKED");
    expect(table).not.toMatch(/^\| \d/m);
    expect(table).not.toContain("0%");
  });

  it("does not call two unmeasured stacks a tie that more n would break", () => {
    const r = rankStacks(
      [
        { stack: "a", scores: [scoreOf("ranges", 12, 12)] },
        { stack: "b", scores: [scoreOf("extract", 12, 12)] },
      ],
      { features: ["ranges", "extract"] },
    );
    expect(r.note).not.toContain("separate");
    expect(r.note).not.toContain("n\u2248");
  });

  // A feature present in `scores` but with n = 0 was never run, so it cannot make two stacks
  // comparable — otherwise a pair of empty runs ranks as a 0% tie.
  it("treats a scored-but-never-run feature as unmeasured, not as common ground", () => {
    const r = rankStacks(
      [
        { stack: "a", scores: [scoreOf("ranges", 12, 12), summarize([], { feature: "extract", attempts: 4 })] },
        { stack: "b", scores: [scoreOf("extract", 12, 12), summarize([], { feature: "ranges", attempts: 4 })] },
      ],
      { features: ["ranges", "extract"] },
    );
    expect(r.comparable).toEqual([]);
    expect(r.ranked).toEqual([]);
    expect(r.ranked.map((v) => v.unmeasured)).toEqual([]);
  });
});

describe("rule 3 — an unmeasured feature is unmeasured, never zero", () => {
  it("separates a feature nobody ran from a feature the stack declared it cannot serve", () => {
    const r = rankStacks(
      [{ stack: "a", scores: [scoreOf("ranges", 12, 12)], unsupported: ["extract"] }],
      { features: ["ranges", "extract", "document"] },
    );
    expect(r.ranked[0]!.unsupported).toEqual(["extract"]);
    expect(r.ranked[0]!.unmeasured).toEqual(["document"]);
    expect(r.ranked[0]!.covered).toBe(1);
  });

  it("does not drag the score down for a feature that was never run", () => {
    const measured = rankStacks([{ stack: "a", scores: [scoreOf("ranges", 12, 12)] }], { features: ["ranges"] });
    const withGap = rankStacks([{ stack: "a", scores: [scoreOf("ranges", 12, 12)] }], { features: ["ranges", "document"] });
    expect(withGap.ranked[0]!.score).toBe(measured.ranked[0]!.score);
  });
});

describe("rule 4 — latency is reported beside the score, never inside it", () => {
  it("gives two stacks with identical pass rates the same score however slow one is", () => {
    const r = rankStacks(
      [
        { stack: "fast", scores: [scoreOf("ranges", 10, 12, 900)] },
        { stack: "slow", scores: [scoreOf("ranges", 10, 12, 244_300)] },
      ],
      { features: ["ranges"] },
    );
    expect(r.ranked[0]!.score).toBeCloseTo(r.ranked[1]!.score);
    const slow = r.ranked.find((v) => v.stack === "slow")!;
    expect(slow.medianMs).toBe(244_300);
  });
});

describe("rule 5 — overlapping intervals are a tie, not an order", () => {
  it("reports two indistinguishable stacks as not separated, with what n would separate them", () => {
    const r = rankStacks(
      [
        { stack: "a", scores: [scoreOf("ranges", 10, 12)] },
        { stack: "b", scores: [scoreOf("ranges", 9, 12)] },
      ],
      { features: ["ranges"] },
    );
    expect(r.ties).toEqual([["a", "b"]]);
    expect(r.note).toContain("Not separated at this n");
    expect(r.note).toMatch(/n≈\d+/);
  });

  it("reports no tie when the intervals genuinely do not overlap", () => {
    const r = rankStacks(
      [
        { stack: "good", scores: [scoreOf("ranges", 40, 40)] },
        { stack: "bad", scores: [scoreOf("ranges", 2, 40)] },
      ],
      { features: ["ranges"] },
    );
    expect(r.ties).toEqual([]);
    expect(r.note).not.toContain("Not separated");
  });
});

describe("rule 6 — weights are declared", () => {
  it("says equal weighting is a choice when no weights were given", () => {
    const r = rankStacks([{ stack: "a", scores: [scoreOf("ranges", 6, 12)] }], { features: ["ranges"] });
    expect(r.note).toContain("equal weight per feature");
  });

  it("names the weights it used when they were given", () => {
    const r = rankStacks(
      [{ stack: "a", scores: [scoreOf("ranges", 12, 12), scoreOf("extract", 0, 12)] }],
      { features: ["ranges", "extract"], weights: { ranges: 3, extract: 1 } },
    );
    expect(r.note).toContain("ranges×3");
    // A weighted mean, not a flat one: 3:1 toward the feature that passed.
    const flat = rankStacks([{ stack: "a", scores: [scoreOf("ranges", 12, 12), scoreOf("extract", 0, 12)] }], {
      features: ["ranges", "extract"],
    });
    expect(r.ranked[0]!.point).toBeGreaterThan(flat.ranked[0]!.point);
  });
});

describe("separatingN", () => {
  it("is Infinity for two identical rates, because no n separates them", () => {
    expect(separatingN(0.8, 0.8)).toBe(Infinity);
  });

  it("needs a larger n for a smaller gap", () => {
    expect(separatingN(0.9, 0.5)).toBeLessThan(separatingN(0.9, 0.8));
  });
});
