import { createGlassState } from "../src/state/glassState";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runStateTests(): void {
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

  assert(state.glass.wCss === 240, "clampGlass should enforce min width");
  assert(state.glass.hCss === 96, "clampGlass should enforce min height");
  assert(state.glass.xCss === 0, "clampGlass should clamp x to canvas bounds");
  assert(state.glass.yCss === 0, "clampGlass should clamp y to canvas bounds");

  state.glass.wCss = 260;
  state.glass.hCss = 320;
  state.clampGlass(1200, 700);
  assert(
    state.glass.hCss <= state.glass.wCss,
    "clampGlass should keep capsule constraint (height <= width)",
  );

  state.startDrag(
    "resize",
    1,
    state.glass.xCss + state.glass.wCss,
    state.glass.yCss + state.glass.hCss * 0.5,
    { r: true },
  );
  state.applyResize(state.drag.startPx - 5000, state.drag.startPy);
  state.endDrag(1);
  assert(
    state.glass.wCss === 240,
    "applyResize should keep width at min bound when shrinking too far",
  );
}
