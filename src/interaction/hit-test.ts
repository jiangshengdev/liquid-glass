import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { sdRoundRect } from "../utils/math";

/** 命中测试结果。 */
export interface HitResult {
  mode: DragMode | null;
  edges: ResizeEdges;
}

/**
 * 对玻璃区域执行命中测试，返回移动或缩放模式。
 * @param glass 玻璃矩形。
 * @param pointerLeft 指针横坐标（CSS 像素）。
 * @param pointerTop 指针纵坐标（CSS 像素）。
 * @param resizeMargin 边缘缩放命中阈值。
 * @returns 命中模式与边缘信息。
 */
export function hitTestGlass(
  glass: GlassRect,
  pointerLeft: number,
  pointerTop: number,
  resizeMargin: number,
): HitResult {
  // 先在圆角矩形 SDF 空间中判断是否处于内部。
  // 计算玻璃中心坐标。
  const centerLeft = glass.left + glass.width * 0.5;
  const centerTop = glass.top + glass.height * 0.5;
  // 计算半宽与半高。
  const halfWidth = glass.width * 0.5;
  const halfHeight = glass.height * 0.5;
  // 圆角半径取高度一半。
  const radius = glass.height * 0.5;
  // 计算指针点的 SDF。
  const signedDistance = sdRoundRect(
    pointerLeft - centerLeft,
    pointerTop - centerTop,
    halfWidth,
    halfHeight,
    radius,
  );
  // SDF 小于等于 0 视为内部。
  const inside = signedDistance <= 0;

  // 移动命中基于圆角形体，缩放命中仍按外接矩形边缘，贴近设计工具手感。
  const rectLeft = glass.left;
  const rectTop = glass.top;
  const rectRight = glass.left + glass.width;
  const rectBottom = glass.top + glass.height;
  // 计算指针到矩形边界的最短距离。
  const deltaLeft = Math.max(
    rectLeft - pointerLeft,
    0,
    pointerLeft - rectRight,
  );
  const deltaTop = Math.max(rectTop - pointerTop, 0, pointerTop - rectBottom);
  // 计算到矩形的欧氏距离。
  const distanceToRect = Math.hypot(deltaLeft, deltaTop);
  // 是否进入缩放激活范围。
  const active = distanceToRect <= resizeMargin;

  const distanceLeft = pointerLeft - glass.left;
  const distanceRight = glass.left + glass.width - pointerLeft;
  const distanceTop = pointerTop - glass.top;
  const distanceBottom = glass.top + glass.height - pointerTop;
  // 取绝对值便于比较。
  const absoluteDistanceLeft = Math.abs(distanceLeft);
  const absoluteDistanceRight = Math.abs(distanceRight);
  const absoluteDistanceTop = Math.abs(distanceTop);
  const absoluteDistanceBottom = Math.abs(distanceBottom);

  // 当左右同时接近时，只保留最近的一侧，避免双边抖动。
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

  // 进入缩放模式需命中边缘且处于激活范围。
  const wantsResize =
    active && (nearLeft || nearRight || nearTop || nearBottom);
  const mode: DragMode | null = wantsResize ? "resize" : inside ? "move" : null;
  return { mode, edges };
}

/**
 * 根据命中结果映射鼠标样式。
 * @param mode 命中模式。
 * @param edges 命中边集合。
 * @returns 对应 CSS cursor 值。
 */
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
