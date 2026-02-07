import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { sdRoundRect } from "../utils/math";

export interface HitResult {
  mode: DragMode | null;
  edges: ResizeEdges;
}

export function hitTestGlass(
  glass: GlassRect,
  px: number,
  py: number,
  resizeMargin: number,
): HitResult {
  const cx = glass.xCss + glass.wCss * 0.5;
  const cy = glass.yCss + glass.hCss * 0.5;
  const halfW = glass.wCss * 0.5;
  const halfH = glass.hCss * 0.5;
  const radius = glass.hCss * 0.5;
  const signedDistance = sdRoundRect(px - cx, py - cy, halfW, halfH, radius);
  const inside = signedDistance <= 0;

  // Move uses rounded shape, while resize handles stay on the AABB like design tools.
  const x1 = glass.xCss;
  const y1 = glass.yCss;
  const x2 = glass.xCss + glass.wCss;
  const y2 = glass.yCss + glass.hCss;
  const dx = Math.max(x1 - px, 0, px - x2);
  const dy = Math.max(y1 - py, 0, py - y2);
  const distRect = Math.hypot(dx, dy);
  const active = distRect <= resizeMargin;

  const distanceLeft = px - glass.xCss;
  const distanceRight = glass.xCss + glass.wCss - px;
  const distanceTop = py - glass.yCss;
  const distanceBottom = glass.yCss + glass.hCss - py;
  const absDistanceLeft = Math.abs(distanceLeft);
  const absDistanceRight = Math.abs(distanceRight);
  const absDistanceTop = Math.abs(distanceTop);
  const absDistanceBottom = Math.abs(distanceBottom);

  let nearLeft = absDistanceLeft < resizeMargin;
  let nearRight = absDistanceRight < resizeMargin;
  if (nearLeft && nearRight) {
    nearLeft = absDistanceLeft <= absDistanceRight;
    nearRight = !nearLeft;
  }

  let nearTop = absDistanceTop < resizeMargin;
  let nearBottom = absDistanceBottom < resizeMargin;
  if (nearTop && nearBottom) {
    nearTop = absDistanceTop <= absDistanceBottom;
    nearBottom = !nearTop;
  }

  const edges: ResizeEdges = active
    ? {
        left: nearLeft,
        right: nearRight,
        top: nearTop,
        bottom: nearBottom,
      }
    : { left: false, right: false, top: false, bottom: false };

  const wantsResize =
    active && (nearLeft || nearRight || nearTop || nearBottom);
  const mode: DragMode | null = wantsResize ? "resize" : inside ? "move" : null;
  return { mode, edges };
}

export function cursorForHit(
  mode: DragMode | null,
  edges: ResizeEdges,
): string {
  if (mode === "resize") {
    const { left, right, top, bottom } = edges;
    if ((left && top) || (right && bottom)) return "nwse-resize";
    if ((right && top) || (left && bottom)) return "nesw-resize";
    if (left || right) return "ew-resize";
    if (top || bottom) return "ns-resize";
  }
  if (mode === "move") return "move";
  return "";
}
