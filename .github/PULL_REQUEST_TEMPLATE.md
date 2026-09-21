## What changed and why

## Checklist

- [ ] `npm test` and `npm run check` pass locally.
- [ ] New behaviour has a test that is red without it, and the test can fail — no conditional skip,
      no loop over a possibly-empty array (see [CONTRIBUTING.md](../CONTRIBUTING.md) § Anti-vacuity).
- [ ] No runtime dependency, no environment read, no vendor/model/endpoint name added to a source
      file. (`tests/packaging.test.ts` enforces this; if it went red, that is the finding.)
- [ ] No probe factory or domain validator added here — probes live with the validator they adapt
      (see [ARCHITECTURE.md](../ARCHITECTURE.md) § 2).
- [ ] If this changes bucket order, censoring, or `runProbe`'s serial execution, it says so
      explicitly above — those are load-bearing (see [ARCHITECTURE.md](../ARCHITECTURE.md) § 4).
- [ ] If this changes a rule, it changed it in the one document that owns it, not in two.
