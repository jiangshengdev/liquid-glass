import { cursorForHit, hitTestGlass } from "../src/interaction/hitTest";
import type { GlassRect } from "../src/types/common";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runHitTestTests(): void {
  const glass: GlassRect = {
    xCss: 100,
    yCss: 100,
    wCss: 360,
    hCss: 120,
  };
  const margin = 18;

  const center = hitTestGlass(glass, 280, 160, margin);
  assert(center.mode === "move", "center point should hit move mode");

  const leftEdge = hitTestGlass(glass, 100, 160, margin);
  assert(leftEdge.mode === "resize", "left edge should hit resize mode");
  assert(leftEdge.edges.l, "left edge should activate left resize handle");
  assert(
    cursorForHit(leftEdge.mode, leftEdge.edges) === "ew-resize",
    "left edge should map to ew-resize cursor",
  );

  const topLeft = hitTestGlass(glass, 100, 100, margin);
  assert(topLeft.mode === "resize", "top-left corner should resize");
  assert(
    cursorForHit(topLeft.mode, topLeft.edges) === "nwse-resize",
    "top-left corner should map to nwse-resize cursor",
  );

  const outside = hitTestGlass(glass, 10, 10, margin);
  assert(outside.mode === null, "far outside point should not hit glass");
  assert(
    cursorForHit(outside.mode, outside.edges) === "",
    "outside point should map to empty cursor",
  );
}
