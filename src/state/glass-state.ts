import type { CanvasState, DragState, GlassState } from "../types/state";
import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { clamp } from "../utils/math";

interface CreateGlassStateOptions {
  minWidth: number;
  minHeight: number;
}

/**
 * 创建玻璃状态容器，集中管理画布尺寸、拖拽状态与几何约束。
 * @param options 最小宽高约束。
 * @returns 玻璃状态对象。
 */
export function createGlassState({
  minWidth,
  minHeight,
}: CreateGlassStateOptions): GlassState {
  // 持久化玻璃矩形（CSS 像素），避免窗口变化时重置位置。
  const glass: GlassRect = { left: 0, top: 0, width: 0, height: 0 };
  let glassInited = false;

  const canvas: CanvasState = {
    pixelWidth: 0,
    pixelHeight: 0,
    devicePixelRatio: 1,
    cssWidth: 0,
    cssHeight: 0,
  };

  const drag: DragState = {
    active: false,
    mode: "move",
    pointerId: -1,
    startPointerLeft: 0,
    startPointerTop: 0,
    startLeft: 0,
    startTop: 0,
    startWidth: 0,
    startHeight: 0,
    left: false,
    right: false,
    top: false,
    bottom: false,
  };

  /**
   * 初始化默认玻璃尺寸与居中位置。
   * @param cssWidth 画布 CSS 宽度。
   * @param cssHeight 画布 CSS 高度。
   * @returns 无返回值。
   */
  function initGlassDefault(cssWidth: number, cssHeight: number): void {
    const nextWidth = Math.min(cssWidth * 0.8, 920);
    const nextHeight = Math.min(cssHeight * 0.32, 280);
    glass.width = Math.max(minWidth, Math.min(cssWidth, nextWidth));
    glass.height = Math.max(minHeight, Math.min(cssHeight, nextHeight));
    // 默认保持横向胶囊外观。
    glass.width = Math.max(glass.width, glass.height);
    glass.left = (cssWidth - glass.width) * 0.5;
    glass.top = (cssHeight - glass.height) * 0.5;
    glassInited = true;
  }

  /**
   * 对玻璃矩形执行尺寸与边界夹取。
   * @param cssWidth 画布 CSS 宽度。
   * @param cssHeight 画布 CSS 高度。
   * @returns 无返回值。
   */
  function clampGlass(cssWidth: number, cssHeight: number): void {
    glass.width = clamp(glass.width, minWidth, Math.max(minWidth, cssWidth));
    glass.height = clamp(
      glass.height,
      minHeight,
      Math.max(minHeight, cssHeight),
    );
    // 胶囊约束：半径 = 高度 / 2，因此高度不能大于宽度。
    glass.height = Math.min(glass.height, glass.width);
    glass.left = clamp(glass.left, 0, Math.max(0, cssWidth - glass.width));
    glass.top = clamp(glass.top, 0, Math.max(0, cssHeight - glass.height));
  }

  /**
   * 更新画布状态，并在必要时初始化玻璃默认值。
   * @param nextCanvas 新画布状态。
   * @returns 像素尺寸或 DPR 是否发生变化。
   */
  function updateCanvasState({
    pixelWidth,
    pixelHeight,
    devicePixelRatio,
    cssWidth,
    cssHeight,
  }: CanvasState): boolean {
    const changed =
      pixelWidth !== canvas.pixelWidth ||
      pixelHeight !== canvas.pixelHeight ||
      devicePixelRatio !== canvas.devicePixelRatio;
    canvas.pixelWidth = pixelWidth;
    canvas.pixelHeight = pixelHeight;
    canvas.devicePixelRatio = devicePixelRatio;
    canvas.cssWidth = cssWidth;
    canvas.cssHeight = cssHeight;

    if (!glassInited) initGlassDefault(cssWidth, cssHeight);
    clampGlass(cssWidth, cssHeight);
    return changed;
  }

  /**
   * 启动一次拖拽会话。
   * @param mode 拖拽模式。
   * @param pointerId 当前指针 ID。
   * @param pointerLeft 指针横坐标。
   * @param pointerTop 指针纵坐标。
   * @param edges 可选命中边信息。
   * @returns 无返回值。
   */
  function startDrag(
    mode: DragMode,
    pointerId: number,
    pointerLeft: number,
    pointerTop: number,
    edges?: Partial<ResizeEdges>,
  ): void {
    drag.active = true;
    drag.mode = mode;
    drag.pointerId = pointerId;
    drag.startPointerLeft = pointerLeft;
    drag.startPointerTop = pointerTop;
    drag.startLeft = glass.left;
    drag.startTop = glass.top;
    drag.startWidth = glass.width;
    drag.startHeight = glass.height;
    drag.left = !!edges?.left;
    drag.right = !!edges?.right;
    drag.top = !!edges?.top;
    drag.bottom = !!edges?.bottom;
  }

  /**
   * 结束拖拽会话。
   * @param pointerId 指针 ID。
   * @returns 无返回值。
   */
  function endDrag(pointerId: number): void {
    if (!drag.active || pointerId !== drag.pointerId) return;
    drag.active = false;
    drag.pointerId = -1;
  }

  /**
   * 应用移动拖拽。
   * @param pointerLeft 指针横坐标。
   * @param pointerTop 指针纵坐标。
   * @returns 无返回值。
   */
  function applyMove(pointerLeft: number, pointerTop: number): void {
    const deltaLeft = pointerLeft - drag.startPointerLeft;
    const deltaTop = pointerTop - drag.startPointerTop;
    glass.left = drag.startLeft + deltaLeft;
    glass.top = drag.startTop + deltaTop;
    clampGlass(canvas.cssWidth, canvas.cssHeight);
  }

  /**
   * 应用缩放拖拽，包含最小尺寸、边界夹取与胶囊约束。
   * @param pointerLeft 指针横坐标。
   * @param pointerTop 指针纵坐标。
   * @returns 无返回值。
   */
  function applyResize(pointerLeft: number, pointerTop: number): void {
    const deltaLeft = pointerLeft - drag.startPointerLeft;
    const deltaTop = pointerTop - drag.startPointerTop;

    let left = drag.startLeft;
    let top = drag.startTop;
    let right = drag.startLeft + drag.startWidth;
    let bottom = drag.startTop + drag.startHeight;

    if (drag.left) left += deltaLeft;
    if (drag.right) right += deltaLeft;
    if (drag.top) top += deltaTop;
    if (drag.bottom) bottom += deltaTop;

    // 先保证最小宽高，优先固定未拖拽边。
    if (right - left < minWidth) {
      if (drag.left && !drag.right) left = right - minWidth;
      else right = left + minWidth;
    }
    if (bottom - top < minHeight) {
      if (drag.top && !drag.bottom) top = bottom - minHeight;
      else bottom = top + minHeight;
    }

    // 再做边界夹取：优先约束正在被拖拽的边。
    if (drag.left && !drag.right) {
      left = clamp(left, 0, right - minWidth);
    } else if (drag.right && !drag.left) {
      right = clamp(right, left + minWidth, canvas.cssWidth);
    } else {
      const nextWidth = right - left;
      left = clamp(left, 0, Math.max(0, canvas.cssWidth - nextWidth));
      right = left + nextWidth;
    }

    if (drag.top && !drag.bottom) {
      top = clamp(top, 0, bottom - minHeight);
    } else if (drag.bottom && !drag.top) {
      bottom = clamp(bottom, top + minHeight, canvas.cssHeight);
    } else {
      const nextHeight = bottom - top;
      top = clamp(top, 0, Math.max(0, canvas.cssHeight - nextHeight));
      bottom = top + nextHeight;
    }

    // 最后应用胶囊约束：始终保持 height <= width。
    const nextWidth = right - left;
    let nextHeight = bottom - top;
    if (nextHeight > nextWidth) {
      const constrainedHeight = nextWidth;
      if (drag.top && !drag.bottom) top = bottom - constrainedHeight;
      else if (drag.bottom && !drag.top) bottom = top + constrainedHeight;
      else {
        const centerTop = (top + bottom) * 0.5;
        top = centerTop - constrainedHeight * 0.5;
        bottom = top + constrainedHeight;
      }
      if (top < 0) {
        top = 0;
        bottom = constrainedHeight;
      }
      if (bottom > canvas.cssHeight) {
        bottom = canvas.cssHeight;
        top = bottom - constrainedHeight;
      }
      nextHeight = bottom - top;
    }

    glass.left = left;
    glass.top = top;
    glass.width = right - left;
    glass.height = nextHeight;
    clampGlass(canvas.cssWidth, canvas.cssHeight);
  }

  return {
    glass,
    drag,
    canvas,
    clampGlass,
    updateCanvasState,
    startDrag,
    endDrag,
    applyMove,
    applyResize,
  };
}
