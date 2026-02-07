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
  const centerX = glass.xCss + glass.wCss * 0.5;
  const centerY = glass.yCss + glass.hCss * 0.5;
  const halfW = glass.wCss * 0.5;
  const halfH = glass.hCss * 0.5;
  const radius = glass.hCss * 0.5;
  const signedDistance = sdRoundRect(
    px - centerX,
    py - centerY,
    halfW,
    halfH,
    radius,
  );
  const inside = signedDistance <= 0;

  // Move uses rounded shape, while resize handles stay on the AABB like design tools.
  const rectLeft = glass.xCss;
  const rectTop = glass.yCss;
  const rectRight = glass.xCss + glass.wCss;
  const rectBottom = glass.yCss + glass.hCss;
  const deltaX = Math.max(rectLeft - px, 0, px - rectRight);
  const deltaY = Math.max(rectTop - py, 0, py - rectBottom);
  const distanceToRect = Math.hypot(deltaX, deltaY);
  const active = distanceToRect <= resizeMargin;

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
