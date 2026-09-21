// Rejections, grouped by reason. A bucket is a thing that happened — keyed on the messages a
// validator actually throws — rather than a category invented after the numbers came back.
//
// ORDER IS LOAD-BEARING and the first match wins. The three operational buckets come first because
// a model that could not be reached, or was refused the input, scores zero on quality it was never
// given the chance to show. Report those as what they are and a flat run stays diagnosable; fold
// them into "other" and a frontier model with an empty account reads as a model that answers badly.

export type BucketTable = readonly (readonly [string, RegExp])[];

/** Domain-free buckets: everything here is about the transport, the account, or the shape of a
 *  response, none of which belongs to any one domain. A package with its own validator passes its
 *  own table and keeps these three at the front. */
export const DEFAULT_BUCKETS: BucketTable = [
  // Not quality at all. Kept first and reported separately.
  ["unreachable", /fetch failed|ECONNREFUSED|ETIMEDOUT|socket hang up|network|502|503|504/i],
  // The provider answered, and its answer was about the account rather than the request: no credit,
  // no key, wrong key, over the rate limit. Found by a real run whose balance had run out, which
  // scored a frontier model 0/12 and filed the reason under "other".
  ["refused", /credit balance|billing|quota|rate.?limit|authentication|invalid x-api-key|permission|\b401\b|\b402\b|\b403\b|\b429\b/i],
  // The provider was reached and willing, and declined this input: a capability it does not have.
  ["unsupported", /cannot take|does not support|model_unsupported|unsupported/i],
  // Response-shape failures, common to any schema-constrained call.
  ["invalid JSON", /invalid JSON|not valid JSON/],
  ["no text block", /no text block/],
  ["truncated", /truncated \(hit max_tokens\)/],
];

/** Prepend the operational buckets to a domain's own, so a caller cannot accidentally put a quality
 *  reason ahead of "unreachable" by listing it first. */
export function withDefaults(domain: BucketTable): BucketTable {
  return [...DEFAULT_BUCKETS, ...domain];
}

export function bucketRejection(message: string, table: BucketTable = DEFAULT_BUCKETS): string {
  return table.find(([, re]) => re.test(message))?.[0] ?? "other";
}
