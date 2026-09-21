// The package's own promises, asserted. Each of these is a claim the README or CONTRIBUTING makes
// about this package, and each one would otherwise be true only until someone changed a file.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  files: string[];
  exports: Record<string, string>;
  dependencies?: Record<string, string>;
};

/** Comments say what the code means; only the code says what it does. */
const isCode = (line: string): boolean => {
  const t = line.trim();
  return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
};

const sources = [
  ...readdirSync(ROOT).filter((f) => f.endsWith(".ts")),
  ...readdirSync(join(ROOT, "testing")).map((f) => join("testing", f)),
];

describe("what ships", () => {
  it("has at least one source module, so the checks below cannot pass vacuously", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it("resolves every declared export subpath to a file that exists", () => {
    for (const [subpath, file] of Object.entries(pkg.exports)) {
      expect(existsSync(join(ROOT, file)), `${subpath} -> ${file}`).toBe(true);
    }
  });

  it("exports every source module except the ones index re-exports through", () => {
    const exported = new Set(Object.values(pkg.exports).map((f) => f.replace("./", "")));
    for (const s of sources) expect(exported.has(s), `${s} has no exports entry`).toBe(true);
  });

  it("keeps tests out of the published allowlist", () => {
    expect(pkg.files).toContain("!tests");
    expect(pkg.files.some((f) => f.startsWith("tests"))).toBe(false);
  });
});

describe("runs with no key and no network", () => {
  it("has no runtime dependencies at all", () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it("constructs no client and reads no credential anywhere in the sources", () => {
    for (const s of sources) {
      const body = readFileSync(join(ROOT, s), "utf8");
      expect(body, `${s} reads the environment`).not.toMatch(/process\.env/);
      expect(body, `${s} names an API key`).not.toMatch(/apiKey|api_key|Authorization:/);
      expect(body, `${s} constructs a client`).not.toMatch(/new Anthropic|new OpenAI/);
    }
  });

  it("imports the SDK for types only, so nothing is reachable at runtime", () => {
    for (const s of sources) {
      const body = readFileSync(join(ROOT, s), "utf8");
      for (const line of body.split("\n").filter(isCode)) {
        if (line.includes("@anthropic-ai/sdk")) expect(line, `${s}: ${line}`).toMatch(/^import type /);
      }
    }
  });

  it("names no vendor, model or endpoint in the harness itself", () => {
    // buckets.ts matches on provider ERROR TEXT, which is a thing that happened, not a vendor name.
    for (const s of sources.filter((f) => f !== "buckets.ts")) {
      const body = readFileSync(join(ROOT, s), "utf8").split("\n").filter(isCode).join("\n");
      expect(body, s).not.toMatch(/claude|gpt-|llama|qwen|gemini|api\.anthropic|api\.openai/i);
    }
  });
});

describe("the suite can fail", () => {
  // This file is the one place the forbidden spellings may appear, because it is the scanner.
  const SCANNER = "packaging.test.ts";
  const tests = readdirSync(join(ROOT, "tests"));

  it("has tests", () => {
    expect(tests.length).toBeGreaterThan(4);
    expect(tests).toContain(SCANNER);
  });

  it("skips nothing conditionally — a skip that goes green without its inputs is a pass", () => {
    for (const t of tests.filter((f) => f !== SCANNER)) {
      const body = readFileSync(join(ROOT, "tests", t), "utf8");
      expect(body, t).not.toMatch(/\.skipIf|\.skip\(|it\.todo|describe\.skip/);
    }
  });
});
