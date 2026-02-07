import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { sdRoundRect } from "../utils/math";

export interface HitResult {
  mode: DragMode | null;
  edges: ResizeEdges;
}

export function hitTestGlass(
  glass: GlassRect,
  pointerLeft: number,
  pointerTop: number,
  resizeMargin: number,
): HitResult {
  const centerLeft = glass.left + glass.width * 0.5;
  const centerTop = glass.top + glass.height * 0.5;
  const halfWidth = glass.width * 0.5;
  const halfHeight = glass.height * 0.5;
  const radius = glass.height * 0.5;
  const signedDistance = sdRoundRect(
    pointerLeft - centerLeft,
    pointerTop - centerTop,
    halfWidth,
    halfHeight,
    radius,
  );
  const inside = signedDistance <= 0;

  // Move uses rounded shape, while resize handles stay on the AABB like design tools.
  const rectLeft = glass.left;
  const rectTop = glass.top;
  const rectRight = glass.left + glass.width;
  const rectBottom = glass.top + glass.height;
  const deltaLeft = Math.max(rectLeft - pointerLeft, 0, pointerLeft - rectRight);
  const deltaTop = Math.max(rectTop - pointerTop, 0, pointerTop - rectBottom);
  const distanceToRect = Math.hypot(deltaLeft, deltaTop);
  const active = distanceToRect <= resizeMargin;

  const distanceLeft = pointerLeft - glass.left;
  const distanceRight = glass.left + glass.width - pointerLeft;
  const distanceTop = pointerTop - glass.top;
  const distanceBottom = glass.top + glass.height - pointerTop;
  const absoluteDistanceLeft = Math.abs(distanceLeft);
  const absoluteDistanceRight = Math.abs(distanceRight);
  const absoluteDistanceTop = Math.abs(distanceTop);
  const absoluteDistanceBottom = Math.abs(distanceBottom);

  let nearLeft = absoluteDistanceLeft < resizeMargin;
  let nearRight = absoluteDistanceRight < resizeMargin;
  if (nearLeft && nearRight) {
    nearLeft = absoluteDistanceLeft <= absoluteDistanceRight;
    nearRight = !nearLeft;
  }

  let nearTop = absoluteDistanceTop < resizeMargin;
  let nearBottom = absoluteDistanceBottom < resizeMargin;
  if (nearTop && nearBottom) {
    nearTop = absoluteDistanceTop <= absoluteDistanceBottom;
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
