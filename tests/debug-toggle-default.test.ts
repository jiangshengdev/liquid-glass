import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("index/debug-toggle", () => {
  it("keeps refraction debug arrows disabled by default", () => {
    const html = readFileSync("index.html", "utf8");
    const match = html.match(
      /<input\b[^>]*\bid="debug-refraction-arrows"[^>]*>/,
    );

    expect(match).not.toBeNull();
    expect(match?.[0]).not.toMatch(/\bchecked\b/);
  });
});
