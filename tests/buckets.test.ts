import { describe, expect, it } from "vitest";
import { bucketRejection, withDefaults, DEFAULT_BUCKETS, type BucketTable } from "../buckets.ts";

const DOMAIN: BucketTable = [
  ["not a report", /is not a medical report/],
  ["missing field", /missing |must be |requires |empty/i],
];

describe("bucketRejection", () => {
  it("puts an unreachable host ahead of a quality reason in the same message", () => {
    // The whole point of the ordering: this message contains BOTH, and a model that was never
    // reached must not be filed as a model that answers badly.
    const message = "fetch failed while retrying: missing field \"unit\"";
    expect(bucketRejection(message, withDefaults(DOMAIN))).toBe("unreachable");
  });

  it("files an empty account as refused, not as other and not as quality", () => {
    expect(bucketRejection("Your credit balance is too low to access the Anthropic API")).toBe("refused");
    expect(bucketRejection("429 rate limit exceeded")).toBe("refused");
  });

  it("files a declared capability gap as unsupported", () => {
    expect(bucketRejection("model_unsupported: this model cannot take a pdf")).toBe("unsupported");
  });

  it("never returns a domain bucket when no domain table was supplied", () => {
    expect(bucketRejection("this is not a medical report")).toBe("other");
    expect(bucketRejection("this is not a medical report", withDefaults(DOMAIN))).toBe("not a report");
  });

  it("keeps the operational buckets in front of whatever a domain lists first", () => {
    const hostile: BucketTable = [["missing field", /.*/]];
    expect(bucketRejection("ECONNREFUSED", withDefaults(hostile))).toBe("unreachable");
    expect(withDefaults(hostile).slice(0, DEFAULT_BUCKETS.length)).toEqual(DEFAULT_BUCKETS);
  });

  it("falls through to other rather than guessing", () => {
    expect(bucketRejection("the model returned a lavender elephant")).toBe("other");
  });
});
