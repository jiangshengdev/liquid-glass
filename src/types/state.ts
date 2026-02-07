import type { DragMode, GlassRect, ResizeEdges } from "./common";

export interface CanvasState {
  pixelWidth: number;
  pixelHeight: number;
  devicePixelRatio: number;
  cssWidth: number;
  cssHeight: number;
}

export interface DragState extends ResizeEdges {
  active: boolean;
  mode: DragMode;
  pointerId: number;
  startPointerLeft: number;
  startPointerTop: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
}

export interface GlassState {
  glass: GlassRect;
  drag: DragState;
  canvas: CanvasState;
  clampGlass(cssWidth: number, cssHeight: number): void;
  updateCanvasState(next: CanvasState): boolean;
  startDrag(
    mode: DragMode,
    pointerId: number,
    pointerLeft: number,
    pointerTop: number,
    edges?: Partial<ResizeEdges>,
  ): void;
  endDrag(pointerId: number): void;
  applyMove(pointerLeft: number, pointerTop: number): void;
  applyResize(pointerLeft: number, pointerTop: number): void;
}
