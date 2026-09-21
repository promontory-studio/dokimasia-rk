import type { AnyProbe } from "./probe.ts";

export interface Budget {
  feature: string;
  cases: number;
  maxCallsPerModel: number;
}

/** What a run would cost in calls, before any is made — the number a --preview exists to print, and
 *  the one a pre-registration has to state. */
export function budget(probes: AnyProbe[], models = 1): Budget[] {
  return probes.map((p) => ({ feature: p.feature, cases: p.cases.length, maxCallsPerModel: p.cases.length * p.attempts * models }));
}

export function totalCalls(probes: AnyProbe[], models = 1): number {
  return budget(probes, models).reduce((s, b) => s + b.maxCallsPerModel, 0);
}
