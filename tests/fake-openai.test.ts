import { afterEach, describe, expect, it } from "vitest";
import { startFakeOpenAI, type FakeOpenAI } from "../testing/fake-openai.ts";

let server: FakeOpenAI | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("startFakeOpenAI", () => {
  it("records what it was sent and answers with what was queued", async () => {
    server = await startFakeOpenAI();
    server.reply({ json: { choices: [{ message: { content: "hi" } }] } });
    const res = await fetch(`${server.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: "Bearer k", "content-type": "application/json" },
      body: JSON.stringify({ model: "m" }),
    });
    expect(await res.json()).toMatchObject({ choices: [{ message: { content: "hi" } }] });
    expect(server.requests[0]).toMatchObject({ path: "/v1/chat/completions", authorization: "Bearer k", body: { model: "m" } });
  });

  it("fails loudly rather than silently when a test forgot to queue a reply", async () => {
    server = await startFakeOpenAI();
    const res = await fetch(`${server.baseUrl}/chat/completions`, { method: "POST", body: "{}" });
    expect(res.status).toBe(500);
  });

  it("serves an error status on command, so a probe's failure path can be exercised", async () => {
    server = await startFakeOpenAI();
    server.reply({ json: { error: { message: "credit balance is too low" } }, status: 402 });
    const res = await fetch(`${server.baseUrl}/chat/completions`, { method: "POST", body: "{}" });
    expect(res.status).toBe(402);
  });

  it("splits every SSE event across two writes, so line buffering is actually exercised", async () => {
    server = await startFakeOpenAI();
    server.reply({ sse: [{ choices: [{ delta: { content: "a" } }] }, { choices: [{ delta: { content: "b" } }] }] });
    const res = await fetch(`${server.baseUrl}/chat/completions`, { method: "POST", body: "{}" });
    const text = await res.text();
    expect(text).toContain('data: {"choices":[{"delta":{"content":"a"}}]}');
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });
});
