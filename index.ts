// dokimasia — assay a feature against a model using the shipping validator as the oracle.
//
// The pieces a host needs in one import; every module is also reachable on its own subpath, which
// is how a domain package takes the probe types without taking the ranker.
export type { MessagesClient, MessagesStream } from "./client.ts";
export { censored, runProbe, runProbeCase, type AnyProbe, type OnRejected, type Probe, type ProbeOutcome } from "./probe.ts";
export { bucketRejection, withDefaults, DEFAULT_BUCKETS, type BucketTable } from "./buckets.ts";
export { measured, summarize, type FeatureScore, type MeasuredScore } from "./score.ts";
export { budget, totalCalls, type Budget } from "./budget.ts";
export { minimumDetectableWins, signTest, successRate, wilson, withReplicates } from "./stats.ts";
export { rankStacks, rankingTable, separatingN, type Ranking, type StackEntry, type StackVerdict, type StackWeights } from "./rank.ts";
export { renderPreRegistration, type PreRegistration, type PreRegistrationSection } from "./preregistration.ts";
