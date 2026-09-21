// Small-n statistics. Every function here exists because the textbook alternative misreports at the
// n a paid run can actually afford — usually by claiming more certainty than a dozen calls can buy.

/** Wilson score interval — the right interval for a proportion at small n, where the textbook
 *  normal approximation puts the bound above 1 and reports [1.00, 1.00] for a clean sweep. */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - half) / d), Math.min(1, (centre + half) / d)];
}

export function successRate(outcomes: { ok: boolean }[]): number {
  return outcomes.length === 0 ? 0 : outcomes.filter((o) => o.ok).length / outcomes.length;
}

/** Exact two-sided sign test over the discordant pairs — the cases where the two arms disagreed.
 *  Paired, because both arms run the same case: cases differ enormously in difficulty, and an
 *  unpaired comparison spends most of its power on that instead of on the thing under test. Ties
 *  carry no information about direction and are excluded, which is the test. */
export function signTest(wins: number, discordant: number): number {
  if (discordant === 0) return 1;
  const tail = Math.min(wins, discordant - wins);
  let sum = 0;
  let c = 1;
  for (let i = 0; i <= tail; i++) {
    sum += c;
    c = (c * (discordant - i)) / (i + 1);
  }
  return Math.min(1, (2 * sum) / Math.pow(2, discordant));
}

/** The smallest number of discordant wins that would reach p < alpha — the minimum detectable
 *  effect, pre-registered rather than discovered afterwards. Returns Infinity when no split of
 *  `discordant` pairs can reach significance, which is the honest answer at very small n and the
 *  reason to compute it BEFORE spending on a run. */
export function minimumDetectableWins(discordant: number, alpha = 0.05): number {
  for (let w = Math.ceil(discordant / 2); w <= discordant; w++) if (signTest(w, discordant) < alpha) return w;
  return Infinity;
}

/** k independent samples per case, expressed as k copies of the case list. Variance across
 *  identical cases is the only way to tell a real difference from one sampling run. */
export function withReplicates<C extends { label: string }>(cases: C[], k: number): C[] {
  return Array.from({ length: k }, (_, r) => cases.map((c) => ({ ...c, label: `${c.label} #${r + 1}` }))).flat();
}
