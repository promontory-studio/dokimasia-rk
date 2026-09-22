// One whole assay, end to end, with no key, no network and no dependency: a shipped path that
// validates, a client that answers from a script instead of a socket, and the two things a deployer
// actually reads — a feature's score, and a ranking over whole stacks.
//
//   node examples/offline-probe.ts        (Node >= 23.6; plain Node 22 needs --experimental-strip-types)
//
// Nothing here is a fixture for this package's tests. It is the shape a consumer writes: the
// validator is the oracle, the probe is a closure over the shipped call, and the harness never
// learns what an invoice is.
import type { MessagesClient, ModelReply } from "../client.ts";
import { withDefaults } from "../buckets.ts";
import { runProbe, type OnRejected, type Probe } from "../probe.ts";
import { summarize, type FeatureScore } from "../score.ts";
import { rankStacks, rankingTable } from "../rank.ts";

// ─── the application ────────────────────────────────────────────────────────────────────────────
// Everything in this block is ordinary production code. None of it imports the harness.

interface Invoice {
  total: number;
  currency: string;
}

const CURRENCIES = new Set(["EUR", "USD", "GBP"]);

/** The oracle: the function that already decides, in production, whether a response is usable. */
function validate(text: string): Invoice {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid JSON in response");
  }
  const { total, currency } = parsed as Partial<Invoice>;
  if (typeof total !== "number") throw new Error('missing field "total"');
  if (!CURRENCIES.has(currency ?? "")) throw new Error(`currency "${currency}" is not one of EUR, USD, GBP`);
  return { total, currency: currency! };
}

async function ask(client: MessagesClient, model: string, doc: string): Promise<string> {
  const message = await client.messages.create({ model, max_tokens: 256, messages: [{ role: "user", content: doc }] });
  const block = message.content[0];
  if (block?.type !== "text") throw new Error("no text block in response");
  return block.text;
}

/** The shipped call, correction loop included. `attempts` is a fact about this path, not a knob the
 *  benchmark turns: measuring it at some other number measures software nobody is running. */
async function extractInvoice(
  client: MessagesClient,
  model: string,
  doc: string,
  attempts: number,
  onRejected: OnRejected,
): Promise<Invoice> {
  let last = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return validate(await ask(client, model, doc));
    } catch (e) {
      last = `attempt ${attempt} rejected: ${(e as Error).message}`;
      if (attempt < attempts) onRejected(last);
    }
  }
  throw new Error(last);
}

/** The domain's own quality reasons, behind the three operational ones `withDefaults` keeps first. */
const INVOICE_BUCKETS = withDefaults([
  ["missing total", /missing field "total"/],
  ["bad currency", /is not one of/],
]);

// ─── the probe ──────────────────────────────────────────────────────────────────────────────────
// A closure over the call above. In a real repo it lives in the package that owns `validate`.

const invoiceProbe = (feature: string, attempts: number, docs: string[]): Probe<string> => ({
  feature,
  cases: docs,
  label: (doc) => doc,
  attempts,
  run: (client, model, doc, onRejected) => extractInvoice(client, model, doc, attempts, onRejected),
});

// ─── the script ─────────────────────────────────────────────────────────────────────────────────
// Replies a real model could have returned, per case, in order. `null` is the transport failing
// before the model ever saw the request — which must not read as a model that answers badly.

const OK = '{"total": 1240.5, "currency": "EUR"}';
const PROSE = "The invoice total is 1240.50 EUR.";
const NO_TOTAL = '{"currency": "EUR"}';
const BAD_CCY = '{"total": 1240.5, "currency": "euros"}';
const DOWN = null;

type Script = (string | null)[][];

const SCRIPTS: Record<string, Record<string, Script>> = {
  frontier: {
    invoice: [[OK], [OK], [OK], [OK], [PROSE, OK], [OK], [DOWN, OK], [OK], [OK], [OK], [NO_TOTAL, BAD_CCY, NO_TOTAL], [OK]],
    total: [[OK], [OK], [OK], [OK], [OK], [OK], [OK], [OK], [OK], [OK], [PROSE], [OK]],
  },
  local: {
    invoice: [[OK], [PROSE, OK], [OK], [NO_TOTAL, NO_TOTAL, NO_TOTAL], [OK], [OK], [BAD_CCY, OK], [OK], [PROSE, PROSE, PROSE], [OK], [OK], [OK]],
    total: [[OK], [OK], [NO_TOTAL], [OK], [OK], [BAD_CCY], [OK], [OK], [OK], [PROSE], [OK], [OK]],
  },
};

const docs = (feature: string, script: Script): string[] => script.map((_, i) => `${feature}-${String(i + 1).padStart(2, "0")}.pdf`);

/** Answers from the script. An unqueued call throws rather than returning a default: a fake that
 *  answers anything can swallow the exact case the run claims to have covered. */
function scriptedClient(script: Script, cases: string[]): MessagesClient {
  const pending = new Map(cases.map((c, i) => [c, [...(script[i] ?? [])]]));
  return {
    messages: {
      create: async (body) => {
        const doc = String(body.messages[0]?.content ?? "");
        const next = pending.get(doc)?.shift();
        if (next === undefined) throw new Error(`nothing queued for ${doc}`);
        if (next === DOWN) throw new Error("fetch failed: connection reset by peer");
        return {
          id: "msg_scripted",
          type: "message",
          role: "assistant",
          model: String(body.model),
          content: [{ type: "text", text: next }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        } as ModelReply;
      },
      stream: () => {
        throw new Error("this example does not stream");
      },
    },
  };
}

// ─── the run ────────────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  { feature: "invoice", attempts: 3 },
  { feature: "total", attempts: 1 },
];

async function scoreStack(stack: string): Promise<FeatureScore[]> {
  const out: FeatureScore[] = [];
  for (const { feature, attempts } of FEATURES) {
    const script = SCRIPTS[stack]![feature]!;
    const probe = invoiceProbe(feature, attempts, docs(feature, script));
    const outcomes = await runProbe(scriptedClient(script, probe.cases), stack, probe);
    out.push(summarize(outcomes, probe, INVOICE_BUCKETS));
  }
  return out;
}

const pct = (v: number | null) => (v === null ? "  —" : `${(v * 100).toFixed(0)}%`.padStart(4));

function report(s: FeatureScore): string {
  const rejections = s.rejections.map((r) => `${r.bucket} ×${r.count}`).join(", ") || "none";
  return [
    `  feature "${s.feature}" on ${s.model}`,
    `    validated      ${String(s.passed).padStart(2)}/${s.n}  ${pct(s.passRate)}   95% CI [${s.ci[0].toFixed(2)}, ${s.ci[1].toFixed(2)}]`,
    `    first try      ${pct(s.firstAttemptPassRate)}`,
    `    mean attempts  ${s.meanAttempts?.toFixed(2)}`,
    `    rejections     ${rejections}`,
    s.rejections[0] ? `                   e.g. ${s.rejections[0].example}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const stacks = ["frontier", "local"];
const scores = new Map(await Promise.all(stacks.map(async (s) => [s, await scoreStack(s)] as const)));

console.log("── per feature ──────────────────────────────────────────────────────────────");
for (const stack of stacks) for (const s of scores.get(stack)!) console.log(report(s), "\n");

console.log("── per stack ────────────────────────────────────────────────────────────────");
console.log(
  rankingTable(
    rankStacks(
      stacks.map((stack) => ({ stack, scores: scores.get(stack)! })),
      { features: FEATURES.map((f) => f.feature) },
    ),
  ),
);
console.log(
  "\nmedian s is 0.0 throughout: a scripted reply answers instantly. On a paid run it is the\n" +
    "column that decides what a tied score actually costs.",
);
