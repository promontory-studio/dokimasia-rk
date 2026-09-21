// A probe is one feature's SHIPPED call plus the cases to run it on. It is written by the package
// that owns the validator, never by this one: the oracle is that package's own validate(), the same
// function that decides in production whether a response is usable.
//
// Nothing here names a vendor, a model or an endpoint. No client is constructed and no key is read —
// the host supplies both.
import type { MessagesClient } from "./client.ts";

/** Called once per rejection the shipped path RETRIED PAST. The final rejection of a failed run is
 *  the thrown error instead, so a reason is never counted twice. */
export type OnRejected = (reason: string) => void;

export interface Probe<C> {
  /** The feature name the host's config routes — "ranges", "extract", … */
  feature: string;
  cases: C[];
  label(c: C): string;
  /** How many attempts the SHIPPED path makes. 1 for a feature with no correction channel. */
  attempts: number;
  /** One run of the shipped path. Resolves when the owning package's own validator accepted it. */
  run(client: MessagesClient, model: string, c: C, onRejected: OnRejected): Promise<unknown>;
}

/** A probe whose case type is not known to the holder. Probes over different case types go in one
 *  list all the time — a host collects one per feature — and `Probe<unknown>` will not accept them
 *  because `cases` and `run` make C invariant. This alias is the one place that cast lives, so a
 *  consumer never writes `p as unknown as Probe<never>` at its own call site. */
export type AnyProbe = Probe<any>;

export interface ProbeOutcome {
  feature: string;
  model: string;
  label: string;
  ok: boolean;
  /** 1..probe.attempts when it validated; probe.attempts + 1 when it never did. */
  attempts: number;
  /** Every rejection in order — the validator's own words, which is what makes a flat result usable. */
  rejections: string[];
  ms: number;
}

/** The score for a case that never validated: one worse than the ceiling, so "failed" orders after
 *  "succeeded on the last attempt" without pretending to know how many more it would have needed. */
export function censored(probe: { attempts: number }): number {
  return probe.attempts + 1;
}

export async function runProbeCase<C>(client: MessagesClient, model: string, probe: Probe<C>, c: C): Promise<ProbeOutcome> {
  const rejections: string[] = [];
  const started = Date.now();
  const base = { feature: probe.feature, model, label: probe.label(c) };
  try {
    await probe.run(client, model, c, (r) => rejections.push(r));
    return { ...base, ok: true, attempts: rejections.length + 1, rejections, ms: Date.now() - started };
  } catch (e) {
    rejections.push((e as Error)?.message ?? String(e));
    return { ...base, ok: false, attempts: censored(probe), rejections, ms: Date.now() - started };
  }
}

/** Cases run in order, never concurrently: a self-hosted server answers one request at a time
 *  anyway, and overlapping calls would make the per-case latency meaningless. Making this parallel
 *  is not an optimisation — it changes what the reported median second means. */
export async function runProbe<C>(client: MessagesClient, model: string, probe: Probe<C>): Promise<ProbeOutcome[]> {
  const out: ProbeOutcome[] = [];
  for (const c of probe.cases) out.push(await runProbeCase(client, model, probe, c));
  return out;
}
