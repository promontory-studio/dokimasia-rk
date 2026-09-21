import { describe, expect, it } from "vitest";
import { minimumDetectableWins, signTest, wilson, withReplicates } from "../stats.ts";

describe("wilson", () => {
  it("never reports [1.00, 1.00] for a clean sweep, which is what the normal approximation does", () => {
    const [lo, hi] = wilson(12, 12);
    expect(hi).toBeCloseTo(1, 10);
    expect(lo).toBeGreaterThan(0.7);
    expect(lo).toBeLessThan(1);
  });

  it("matches the textbook interval at a known point", () => {
    const [lo, hi] = wilson(8, 10);
    expect(lo).toBeCloseTo(0.4902, 3);
    expect(hi).toBeCloseTo(0.9433, 3);
  });

  it("returns the whole range at n = 0 rather than a confident zero", () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
  });

  it("stays inside [0, 1] at the extremes", () => {
    expect(wilson(0, 3)[0]).toBe(0);
    expect(wilson(3, 3)[1]).toBe(1);
  });
});

describe("signTest", () => {
  it("is 1 when nothing disagreed", () => {
    expect(signTest(0, 0)).toBe(1);
  });

  it("reaches significance only once the split is lopsided enough", () => {
    expect(signTest(5, 5)).toBeCloseTo(2 / 32, 6);
    expect(signTest(4, 5)).toBeGreaterThan(0.05);
  });
});

describe("minimumDetectableWins", () => {
  it("says Infinity at an n where no split could ever reach p < 0.05", () => {
    // Five discordant pairs: even a clean sweep only gets to p = 0.0625.
    expect(minimumDetectableWins(5)).toBe(Infinity);
  });

  it("names the smallest winning split once one exists", () => {
    expect(minimumDetectableWins(6)).toBe(6);
    expect(minimumDetectableWins(10)).toBe(9);
  });
});

describe("withReplicates", () => {
  it("labels each replicate so variance across identical cases is visible", () => {
    const out = withReplicates([{ label: "a" }, { label: "b" }], 2);
    expect(out.map((c) => c.label)).toEqual(["a #1", "b #1", "a #2", "b #2"]);
  });
});
