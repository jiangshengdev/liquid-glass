import { describe, expect, it } from "vitest";

import { createGlassState } from "../src/state/glassState";

describe("state/glassState", () => {
  it("enforces min size and canvas bounds in clampGlass", () => {
    const state = createGlassState({ minW: 240, minH: 96 });
    state.updateCanvasState({
      pxW: 1200,
      pxH: 700,
      dpr: 1,
      cssW: 1200,
      cssH: 700,
    });

    state.glass.wCss = 12;
    state.glass.hCss = 24;
    state.glass.xCss = -50;
    state.glass.yCss = -20;
    state.clampGlass(1200, 700);

    expect(state.glass.wCss).toBe(240);
    expect(state.glass.hCss).toBe(96);
    expect(state.glass.xCss).toBe(0);
    expect(state.glass.yCss).toBe(0);
  });

  it("keeps capsule constraint (height <= width)", () => {
    const state = createGlassState({ minW: 240, minH: 96 });
    state.updateCanvasState({
      pxW: 1200,
      pxH: 700,
      dpr: 1,
      cssW: 1200,
      cssH: 700,
    });

    state.glass.wCss = 260;
    state.glass.hCss = 320;
    state.clampGlass(1200, 700);

    expect(state.glass.hCss).toBeLessThanOrEqual(state.glass.wCss);
  });

  it("keeps resize width at min bound when shrinking too far", () => {
    const state = createGlassState({ minW: 240, minH: 96 });
    state.updateCanvasState({
      pxW: 1200,
      pxH: 700,
      dpr: 1,
      cssW: 1200,
      cssH: 700,
    });

    state.startDrag(
      "resize",
      1,
      state.glass.xCss + state.glass.wCss,
      state.glass.yCss + state.glass.hCss * 0.5,
      { r: true },
    );
    state.applyResize(state.drag.startPx - 5000, state.drag.startPy);
    state.endDrag(1);

    expect(state.glass.wCss).toBe(240);
  });
});
