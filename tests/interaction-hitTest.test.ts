import { describe, expect, it } from "vitest";

import { cursorForHit, hitTestGlass } from "../src/interaction/hitTest";
import type { GlassRect } from "../src/types/common";

describe("interaction/hitTest", () => {
  const glass: GlassRect = {
    xCss: 100,
    yCss: 100,
    wCss: 360,
    hCss: 120,
  };
  const margin = 18;

  it("detects center point as move mode", () => {
    const center = hitTestGlass(glass, 280, 160, margin);

    expect(center.mode).toBe("move");
  });

  it("detects left edge as resize and maps ew cursor", () => {
    const leftEdge = hitTestGlass(glass, 100, 160, margin);

    expect(leftEdge.mode).toBe("resize");
    expect(leftEdge.edges.l).toBe(true);
    expect(cursorForHit(leftEdge.mode, leftEdge.edges)).toBe("ew-resize");
  });

  it("detects top-left corner as resize and maps nwse cursor", () => {
    const topLeft = hitTestGlass(glass, 100, 100, margin);

    expect(topLeft.mode).toBe("resize");
    expect(cursorForHit(topLeft.mode, topLeft.edges)).toBe("nwse-resize");
  });

  it("returns null mode and empty cursor for far outside point", () => {
    const outside = hitTestGlass(glass, 10, 10, margin);

    expect(outside.mode).toBeNull();
    expect(cursorForHit(outside.mode, outside.edges)).toBe("");
  });
});
