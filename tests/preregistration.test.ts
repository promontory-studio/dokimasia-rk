import { describe, expect, it } from "vitest";
import { renderPreRegistration, type PreRegistration } from "../preregistration.ts";

const REG: PreRegistration = {
  committed: "2026-09-21",
  authority: { label: "METHOD.md", url: "https://example.invalid/METHOD.md" },
  sections: [
    { heading: "Claim under test", body: "The prompts were written against one vendor's models." },
    { heading: "Outcome", body: "Validated / n per feature, with a Wilson interval." },
  ],
};

describe("renderPreRegistration", () => {
  it("renders the same text every time, which is what makes --preview checkable against a page", () => {
    expect(renderPreRegistration(REG)).toBe(renderPreRegistration(REG));
  });

  it("leads with the commit date and the authority it was written against", () => {
    const out = renderPreRegistration(REG);
    expect(out.split("\n")[0]).toContain("2026-09-21");
    expect(out).toContain("[`METHOD.md`](https://example.invalid/METHOD.md)");
  });

  it("emits one bullet per section, headed in bold", () => {
    const bullets = renderPreRegistration(REG).split("\n").filter((l) => l.startsWith("- "));
    expect(bullets).toHaveLength(2);
    expect(bullets[0]).toContain("**Claim under test.**");
  });

  it("wraps without losing or reordering a word", () => {
    const long = { ...REG, sections: [{ heading: "H", body: "word ".repeat(60).trim() }] };
    const out = renderPreRegistration(long, 60);
    expect(out.split("\n").some((l) => l.length > 62)).toBe(false);
    expect(out.match(/\bword\b/g)).toHaveLength(60);
  });
});
