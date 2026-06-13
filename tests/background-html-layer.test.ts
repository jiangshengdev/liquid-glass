import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("index/background-html-layer", () => {
  it("provides demo HTML elements for the background canvas layer", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('id="background-html-layer"');
    expect(html).toContain("bg-demo-card");
    expect(html).toContain("bg-demo-chip");
  });

  it("keeps the copy source bounded instead of full canvas sized", () => {
    const css = readFileSync("src/style.css", "utf8");
    const match = css.match(/\.background-html-layer\s*\{[^}]*\}/);

    expect(match).not.toBeNull();
    expect(match?.[0]).not.toContain("inset: 0");
    expect(match?.[0]).toContain("width:");
    expect(match?.[0]).toContain("height:");
  });
});
