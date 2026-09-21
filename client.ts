// The slice of a Messages-shaped client this harness calls, stated structurally. The Anthropic SDK
// satisfies it as-is; so does an adapter speaking another provider's API behind the Messages format,
// which is how the same probe runs against a model that is not Claude.
//
// This is a PORT, not shared code. A domain package that declares the same interface for its own
// call cores is not duplicating a fact: both are independent statements of one external contract
// (@anthropic-ai/sdk's), which neither owns. Structural typing makes them mutually assignable with
// zero coupling, and an SDK change breaks both identically at compile time. Importing this type
// into a domain package's PRODUCTION code would instead make that package depend on a benchmark
// harness — see ARCHITECTURE.md, "The harness never depends on a domain package."
import type Anthropic from "@anthropic-ai/sdk";

export interface MessagesStream extends AsyncIterable<Anthropic.RawMessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Message>;
}

export interface MessagesClient {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }): Promise<Anthropic.Message>;
    stream(body: Anthropic.MessageStreamParams, options?: { signal?: AbortSignal }): MessagesStream;
  };
}
