import type { GlassRect } from "../types/common";

/** 交互层切换输入。 */
interface SyncInteractionLayersOptions {
  /** WebGPU 画布。 */
  canvas: HTMLCanvasElement;
  /** 背景 HTML 层。 */
  backgroundHtmlLayer: HTMLDivElement | null;
  /** 玻璃矩形命中层。 */
  glassHitLayer: HTMLDivElement | null;
  /** debug 拖动是否启用。 */
  debugActive: boolean;
}

/**
 * 根据 debug 状态切换全屏指针归属。
 * @param options 交互层元素与模式。
 * @returns 无返回值。
 */
export function syncInteractionLayers({
  canvas,
  backgroundHtmlLayer,
  glassHitLayer,
  debugActive,
}: SyncInteractionLayersOptions): void {
  canvas.style.pointerEvents = debugActive ? "auto" : "none";
  if (backgroundHtmlLayer) {
    backgroundHtmlLayer.style.pointerEvents = debugActive ? "none" : "auto";
  }
  if (glassHitLayer) {
    glassHitLayer.style.pointerEvents = "auto";
  }
}

/**
 * 将透明命中层同步到玻璃矩形。
 * @param glassHitLayer 玻璃命中层。
 * @param glass 玻璃矩形。
 * @returns 无返回值。
 */
export function syncGlassHitLayerGeometry(
  glassHitLayer: HTMLDivElement | null,
  glass: GlassRect,
): void {
  if (!glassHitLayer) return;

  glassHitLayer.style.left = `${glass.left}px`;
  glassHitLayer.style.top = `${glass.top}px`;
  glassHitLayer.style.width = `${glass.width}px`;
  glassHitLayer.style.height = `${glass.height}px`;
}
