import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("index/background-html-layer", () => {
  it("provides demo HTML elements for the background canvas layer", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('id="background-html-layer"');
    expect(html).toContain('id="glass-hit-layer"');
    expect(html).toContain("bg-demo-card");
    expect(html).toContain("bg-demo-chip");
  });

  it("uses real buttons for background chip controls", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('<button class="bg-demo-chip" type="button"');
    expect(html).not.toContain('<span class="bg-demo-chip"');
    expect(html).not.toContain("aria-pressed");
  });

  it("uses a real button for the Liquid Glass demo note", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain(
      '<button class="bg-demo-note" type="button">Liquid Glass demo</button>',
    );
    expect(html).not.toContain('<div class="bg-demo-note">');
  });

  it("includes a real interactive control in the background layer", () => {
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain('id="background-html-control"');
    expect(html).toContain('type="range"');
  });

  it("allows selecting normal text in the background layer", () => {
    const css = readFileSync("src/style.css", "utf8");
    const match = css.match(/\.background-html-layer\s*\{[^}]*\}/);

    expect(match).not.toBeNull();
    expect(match?.[0]).toContain("user-select: text");
    expect(match?.[0]).toContain("cursor: text");
  });

  it("uses normal button interaction styles instead of toggle styles", () => {
    const css = readFileSync("src/style.css", "utf8");

    expect(css).toContain(".bg-demo-chip:hover");
    expect(css).toContain(".bg-demo-chip:active");
    expect(css).toContain(".bg-demo-note:hover");
    expect(css).toContain(".bg-demo-note:active");
    expect(css).not.toContain("[aria-pressed");
  });

  it("matches the browser viewport size without using inset shorthand", () => {
    const css = readFileSync("src/style.css", "utf8");
    const match = css.match(/\.background-html-layer\s*\{[^}]*\}/);

    expect(match).not.toBeNull();
    expect(match?.[0]).not.toContain("inset: 0");
    expect(match?.[0]).toContain("width: 100vw");
    expect(match?.[0]).toContain("height: 100vh");
  });

  it("provides a dedicated transparent hit layer for the glass rectangle", () => {
    const css = readFileSync("src/style.css", "utf8");
    const match = css.match(/\.glass-hit-layer\s*\{[^}]*\}/);

    expect(match).not.toBeNull();
    expect(match?.[0]).toContain("position: absolute");
    expect(match?.[0]).toContain("background: transparent");
  });

  it("lets background controls inherit layer pointer-event mode", () => {
    const css = readFileSync("src/style.css", "utf8");
    const match = css.match(/\.bg-demo-control input\s*\{[^}]*\}/);

    expect(match).not.toBeNull();
    expect(match?.[0]).not.toContain("pointer-events");
  });
});
