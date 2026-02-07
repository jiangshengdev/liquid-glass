import { describe, expect, it } from "vitest";

import { createGlassState } from "../src/state/glassState";

describe("state/glassState", () => {
  it("enforces min size and canvas bounds in clampGlass", () => {
    const state = createGlassState({ minWidth: 240, minHeight: 96 });
    state.updateCanvasState({
      pixelWidth: 1200,
      pixelHeight: 700,
      devicePixelRatio: 1,
      cssWidth: 1200,
      cssHeight: 700,
    });

    state.glass.width = 12;
    state.glass.height = 24;
    state.glass.left = -50;
    state.glass.top = -20;
    state.clampGlass(1200, 700);

    expect(state.glass.width).toBe(240);
    expect(state.glass.height).toBe(96);
    expect(state.glass.left).toBe(0);
    expect(state.glass.top).toBe(0);
  });

  it("keeps capsule constraint (height <= width)", () => {
    const state = createGlassState({ minWidth: 240, minHeight: 96 });
    state.updateCanvasState({
      pixelWidth: 1200,
      pixelHeight: 700,
      devicePixelRatio: 1,
      cssWidth: 1200,
      cssHeight: 700,
    });

    state.glass.width = 260;
    state.glass.height = 320;
    state.clampGlass(1200, 700);

    expect(state.glass.height).toBeLessThanOrEqual(state.glass.width);
  });

  it("keeps resize width at min bound when shrinking too far", () => {
    const state = createGlassState({ minWidth: 240, minHeight: 96 });
    state.updateCanvasState({
      pixelWidth: 1200,
      pixelHeight: 700,
      devicePixelRatio: 1,
      cssWidth: 1200,
      cssHeight: 700,
    });

    state.startDrag(
      "resize",
      1,
      state.glass.left + state.glass.width,
      state.glass.top + state.glass.height * 0.5,
      { right: true },
    );
    state.applyResize(
      state.drag.startPointerLeft - 5000,
      state.drag.startPointerTop,
    );
    state.endDrag(1);

    expect(state.glass.width).toBe(240);
  });
});
