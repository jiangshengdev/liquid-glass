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
  // 标记是否已初始化默认几何。
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
    // 先按画布比例给出目标尺寸。
    const nextWidth = Math.min(cssWidth * 0.8, 920);
    const nextHeight = Math.min(cssHeight * 0.32, 280);
    // 保证最小宽度。
    glass.width = Math.max(minWidth, Math.min(cssWidth, nextWidth));
    // 保证最小高度。
    glass.height = Math.max(minHeight, Math.min(cssHeight, nextHeight));
    // 默认保持横向胶囊外观。
    glass.width = Math.max(glass.width, glass.height);
    // 居中放置。
    glass.left = (cssWidth - glass.width) * 0.5;
    glass.top = (cssHeight - glass.height) * 0.5;
    // 设置初始化完成标记。
    glassInited = true;
  }

  /**
   * 对玻璃矩形执行尺寸与边界夹取。
   * @param cssWidth 画布 CSS 宽度。
   * @param cssHeight 画布 CSS 高度。
   * @returns 无返回值。
   */
  function clampGlass(cssWidth: number, cssHeight: number): void {
    // 限制宽度到可用区间。
    glass.width = clamp(glass.width, minWidth, Math.max(minWidth, cssWidth));
    // 限制高度到可用区间。
    glass.height = clamp(
      glass.height,
      minHeight,
      Math.max(minHeight, cssHeight),
    );
    // 胶囊约束：半径 = 高度 / 2，因此高度不能大于宽度。
    glass.height = Math.min(glass.height, glass.width);
    // 限制左边界。
    glass.left = clamp(glass.left, 0, Math.max(0, cssWidth - glass.width));
    // 限制上边界。
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
    // 只有像素尺寸或 DPR 变化才视为画布发生变化。
    const changed =
      pixelWidth !== canvas.pixelWidth ||
      pixelHeight !== canvas.pixelHeight ||
      devicePixelRatio !== canvas.devicePixelRatio;
    // 写入像素尺寸与 DPR。
    canvas.pixelWidth = pixelWidth;
    canvas.pixelHeight = pixelHeight;
    canvas.devicePixelRatio = devicePixelRatio;
    // 写入 CSS 尺寸。
    canvas.cssWidth = cssWidth;
    canvas.cssHeight = cssHeight;

    // 首次进入时初始化默认玻璃尺寸。
    if (!glassInited) initGlassDefault(cssWidth, cssHeight);
    // 每次更新都需夹取边界。
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
    // 进入拖拽状态。
    drag.active = true;
    // 记录拖拽模式。
    drag.mode = mode;
    // 记录指针 ID。
    drag.pointerId = pointerId;
    // 记录指针起点。
    drag.startPointerLeft = pointerLeft;
    drag.startPointerTop = pointerTop;
    // 记录玻璃起点。
    drag.startLeft = glass.left;
    drag.startTop = glass.top;
    // 记录玻璃起始尺寸。
    drag.startWidth = glass.width;
    drag.startHeight = glass.height;
    // 记录命中边。
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
    // 仅当前指针可结束拖拽。
    if (!drag.active || pointerId !== drag.pointerId) return;
    // 清理拖拽状态。
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
    // 计算指针偏移量。
    const deltaLeft = pointerLeft - drag.startPointerLeft;
    const deltaTop = pointerTop - drag.startPointerTop;
    // 应用偏移到玻璃位置。
    glass.left = drag.startLeft + deltaLeft;
    glass.top = drag.startTop + deltaTop;
    // 夹取边界与尺寸。
    clampGlass(canvas.cssWidth, canvas.cssHeight);
  }

  /**
   * 应用缩放拖拽，包含最小尺寸、边界夹取与胶囊约束。
   * @param pointerLeft 指针横坐标。
   * @param pointerTop 指针纵坐标。
   * @returns 无返回值。
   */
  function applyResize(pointerLeft: number, pointerTop: number): void {
    // 计算指针偏移量。
    const deltaLeft = pointerLeft - drag.startPointerLeft;
    const deltaTop = pointerTop - drag.startPointerTop;

    // 以拖拽起点为基准推导四边。
    let left = drag.startLeft;
    let top = drag.startTop;
    let right = drag.startLeft + drag.startWidth;
    let bottom = drag.startTop + drag.startHeight;

    // 根据命中边应用偏移。
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
      // 左边拖拽：限制 left。
      left = clamp(left, 0, right - minWidth);
    } else if (drag.right && !drag.left) {
      // 右边拖拽：限制 right。
      right = clamp(right, left + minWidth, canvas.cssWidth);
    } else {
      // 同时拖拽或移动：保持宽度不变。
      const nextWidth = right - left;
      left = clamp(left, 0, Math.max(0, canvas.cssWidth - nextWidth));
      right = left + nextWidth;
    }

    if (drag.top && !drag.bottom) {
      // 上边拖拽：限制 top。
      top = clamp(top, 0, bottom - minHeight);
    } else if (drag.bottom && !drag.top) {
      // 下边拖拽：限制 bottom。
      bottom = clamp(bottom, top + minHeight, canvas.cssHeight);
    } else {
      // 同时拖拽或移动：保持高度不变。
      const nextHeight = bottom - top;
      top = clamp(top, 0, Math.max(0, canvas.cssHeight - nextHeight));
      bottom = top + nextHeight;
    }

    // 最后应用胶囊约束：始终保持 height <= width。
    const nextWidth = right - left;
    let nextHeight = bottom - top;
    if (nextHeight > nextWidth) {
      // 约束高度到宽度范围。
      const constrainedHeight = nextWidth;
      if (drag.top && !drag.bottom) top = bottom - constrainedHeight;
      else if (drag.bottom && !drag.top) bottom = top + constrainedHeight;
      else {
        // 同时拖拽时以中心对齐。
        const centerTop = (top + bottom) * 0.5;
        top = centerTop - constrainedHeight * 0.5;
        bottom = top + constrainedHeight;
      }
      // 处理上越界。
      if (top < 0) {
        top = 0;
        bottom = constrainedHeight;
      }
      // 处理下越界。
      if (bottom > canvas.cssHeight) {
        bottom = canvas.cssHeight;
        top = bottom - constrainedHeight;
      }
      // 更新高度结果。
      nextHeight = bottom - top;
    }

    // 回写几何结果。
    glass.left = left;
    glass.top = top;
    glass.width = right - left;
    glass.height = nextHeight;
    // 最终再夹取一次，确保边界正确。
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
