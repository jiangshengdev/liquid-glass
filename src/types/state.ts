import type { DragMode, GlassRect, ResizeEdges } from "./common";

/** 画布尺寸与像素比状态。 */
export interface CanvasState {
  /** 像素级宽度。 */
  pixelWidth: number;
  /** 像素级高度。 */
  pixelHeight: number;
  /** 设备像素比。 */
  devicePixelRatio: number;
  /** CSS 宽度。 */
  cssWidth: number;
  /** CSS 高度。 */
  cssHeight: number;
}

/** 拖拽过程中的状态快照。 */
export interface DragState extends ResizeEdges {
  /** 是否处于拖拽中。 */
  active: boolean;
  /** 当前拖拽模式。 */
  mode: DragMode;
  /** 当前指针 ID。 */
  pointerId: number;
  /** 拖拽起点指针横坐标。 */
  startPointerLeft: number;
  /** 拖拽起点指针纵坐标。 */
  startPointerTop: number;
  /** 拖拽起点玻璃左侧坐标。 */
  startLeft: number;
  /** 拖拽起点玻璃顶部坐标。 */
  startTop: number;
  /** 拖拽起点玻璃宽度。 */
  startWidth: number;
  /** 拖拽起点玻璃高度。 */
  startHeight: number;
}

/** 玻璃状态容器与操作方法。 */
export interface GlassState {
  /** 玻璃矩形几何。 */
  glass: GlassRect;
  /** 拖拽状态。 */
  drag: DragState;
  /** 画布状态。 */
  canvas: CanvasState;
  /** 对玻璃矩形执行尺寸与边界夹取。 */
  clampGlass(cssWidth: number, cssHeight: number): void;
  /** 更新画布状态，并返回是否发生变化。 */
  updateCanvasState(next: CanvasState): boolean;
  /** 启动拖拽会话。 */
  startDrag(
    mode: DragMode,
    pointerId: number,
    pointerLeft: number,
    pointerTop: number,
    edges?: Partial<ResizeEdges>,
  ): void;
  /** 结束拖拽会话。 */
  endDrag(pointerId: number): void;
  /** 应用移动拖拽。 */
  applyMove(pointerLeft: number, pointerTop: number): void;
  /** 应用缩放拖拽。 */
  applyResize(pointerLeft: number, pointerTop: number): void;
}
