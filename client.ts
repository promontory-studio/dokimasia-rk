// The slice of a Messages-shaped client this harness calls, declared outright. Nothing here is
// imported from a vendor SDK: a package whose whole claim is that it names no vendor cannot depend on
// one to state its own types, not even at compile time. What keeps the declaration honest is
// tests/client-port.test-d.ts, which assigns a real SDK client to MessagesClient and so fails the
// build the day the two drift apart — the SDK is a devDependency of that test, never a dependency of
// the published type.
//
// Only what a CALLER reads is stated. The harness itself reads nothing: it hands the client to the
// probe and the probe hands it to the shipped call. Everything unread is left out or left open, so a
// provider-specific field passes through untouched.
//
// This is a PORT, not shared code. A domain package that declares the same interface for its own
// call cores is not duplicating a fact: both are independent statements of one external contract —
// the Messages request and reply shape — which neither owns. Structural typing makes them mutually
// assignable with zero coupling, and a contract change breaks both identically at compile time.
// Importing this type into a domain package's PRODUCTION code would instead make that package depend
// on a benchmark harness — see ARCHITECTURE.md, "The harness never depends on a domain package."

/** Token counts, as nullable as the wire makes them: an adapter that reports neither still fits. */
export interface ModelUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface TextReplyBlock {
  type: "text";
  text: string;
}

/** Every block that is not text — thinking, a tool call, a server tool result, whatever a provider
 *  adds next. The discriminant is a pattern rather than a bare `string` for one reason: bare `string`
 *  keeps this member alive under a `type === "text"` test, and then `text` is not a string. Every
 *  non-text type in the contract today either contains an underscore or is `thinking`; one that is
 *  neither fails tests/client-port.test-d.ts, which is where it gets added. */
export interface OtherReplyBlock {
  type: "thinking" | `${string}_${string}`;
}

export type ReplyBlock = TextReplyBlock | OtherReplyBlock;

/** What a caller reads off a reply, and nothing more. No index signature: an interface has no
 *  implicit one, so a real SDK Message would stop being assignable to this the moment it gained one. */
export interface ModelReply {
  content: ReplyBlock[];
  stop_reason: string | null;
  usage: ModelUsage;
}

/** One request. model, max_tokens and messages are the three every Messages-shaped endpoint takes;
 *  the index signature carries the rest — output_config, thinking, temperature, a provider extension
 *  — through without this file having to know it exists. The `any` in the three pass-through slots is
 *  deliberate: a request travels port -> provider, so a WIDER declared type is the error here, and
 *  `unknown` would make the port stricter than the contract it has to be accepted by. */
export interface ModelRequest {
  model: string;
  max_tokens: number;
  messages: Array<{ role: "user" | "assistant"; content: string | any[] }>;
  system?: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } | null }>;
  tools?: any[];
  tool_choice?: any;
  [key: string]: unknown;
}

/** A streamed event, opaque on purpose: the harness counts attempts, not deltas. */
export interface StreamEvent {
  type: string;
}

export interface MessagesStream extends AsyncIterable<StreamEvent> {
  finalMessage(): Promise<ModelReply>;
}

export interface MessagesClient {
  messages: {
    create(body: ModelRequest, options?: { signal?: AbortSignal }): Promise<ModelReply>;
    stream(body: ModelRequest, options?: { signal?: AbortSignal }): MessagesStream;
  };
}
