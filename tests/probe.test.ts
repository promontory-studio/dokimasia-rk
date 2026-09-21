// The scoring loop, proven against scripted replies. Everything here runs with no key and no
// network: a probe is a function, and these give it one that answers on command.
import { describe, expect, it } from "vitest";
import { censored, runProbe, runProbeCase, type Probe } from "../probe.ts";
import type { MessagesClient } from "../client.ts";

const noClient = {} as MessagesClient;

/** A probe over strings whose script says, per case, how many rejections precede the accept — or
 *  `null` to never accept, which is what a censored case is. */
function scripted(script: Record<string, number | null>, attempts = 4): Probe<string> {
  return {
    feature: "scripted",
    cases: Object.keys(script),
    label: (c) => c,
    attempts,
    async run(_client, _model, c, onRejected) {
      const before = script[c];
      if (before === null) {
        for (let i = 0; i < attempts - 1; i++) onRejected(`attempt ${i + 1} rejected: missing field "x"`);
        throw new Error(`attempt ${attempts} rejected: missing field "x"`);
      }
      for (let i = 0; i < (before ?? 0); i++) onRejected(`attempt ${i + 1} rejected: missing field "x"`);
      return { ok: true };
    },
  };
}

describe("runProbeCase", () => {
  it("counts attempts as rejections + 1 when the validator finally accepted", async () => {
    const probe = scripted({ a: 2 });
    const out = await runProbeCase(noClient, "m", probe, "a");
    expect(out.ok).toBe(true);
    expect(out.attempts).toBe(3);
    expect(out.rejections).toHaveLength(2);
  });

  it("censors a case that never validated at one past the shipped ceiling", async () => {
    const probe = scripted({ a: null }, 4);
    const out = await runProbeCase(noClient, "m", probe, "a");
    expect(out.ok).toBe(false);
    // Not 4. A ceiling failure must not be indistinguishable from success on the last attempt.
    expect(out.attempts).toBe(5);
    expect(out.attempts).toBe(censored(probe));
  });

  it("records the thrown rejection exactly once, never twice", async () => {
    const probe = scripted({ a: null }, 3);
    const out = await runProbeCase(noClient, "m", probe, "a");
    expect(out.rejections).toHaveLength(3);
    expect(new Set(out.rejections).size).toBe(3);
  });

  it("scores a probe with no correction channel at 2 when its single attempt failed", async () => {
    const out = await runProbeCase(noClient, "m", scripted({ a: null }, 1), "a");
    expect(out.attempts).toBe(2);
  });
});

describe("runProbe", () => {
  it("runs cases in order and never concurrently", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const probe: Probe<string> = {
      feature: "serial",
      cases: ["a", "b", "c"],
      label: (c) => c,
      attempts: 1,
      async run(_client, _model, c) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        order.push(c);
        inFlight--;
        return null;
      },
    };
    await runProbe(noClient, "m", probe);
    expect(order).toEqual(["a", "b", "c"]);
    // Latency per case is only meaningful if calls do not overlap.
    expect(maxInFlight).toBe(1);
  });
});
