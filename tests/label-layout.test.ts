import { describe, expect, it } from "vitest";

import { computeGlassButtonLabelFontSize } from "../src/ui/label-layout";

describe("ui/label-layout", () => {
  it("uses the minimum font size for small glass buttons", () => {
    const fontSize = computeGlassButtonLabelFontSize({
      width: 120,
      height: 32,
      text: "Liquid Glass",
    });

    expect(fontSize).toBe(14);
  });

  it("limits the font size by available text width", () => {
    const fontSize = computeGlassButtonLabelFontSize({
      width: 240,
      height: 120,
      text: "Liquid Glass",
    });

    expect(fontSize).toBeCloseTo(240 / 9.5);
  });

  it("caps the font size for large glass buttons", () => {
    const fontSize = computeGlassButtonLabelFontSize({
      width: 1200,
      height: 400,
      text: "Liquid Glass",
    });

    expect(fontSize).toBe(42);
  });
});
