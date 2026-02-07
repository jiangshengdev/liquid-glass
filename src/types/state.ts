import type { DragMode, GlassRect, ResizeEdges } from "./common";

export interface CanvasState {
  pxW: number;
  pxH: number;
  dpr: number;
  cssW: number;
  cssH: number;
}

export interface DragState extends ResizeEdges {
  active: boolean;
  mode: DragMode;
  pointerId: number;
  startPx: number;
  startPy: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export interface GlassState {
  glass: GlassRect;
  drag: DragState;
  canvas: CanvasState;
  clampGlass(cssW: number, cssH: number): void;
  updateCanvasState(next: CanvasState): boolean;
  startDrag(
    mode: DragMode,
    pointerId: number,
    px: number,
    py: number,
    edges?: Partial<ResizeEdges>,
  ): void;
  endDrag(pointerId: number): void;
  applyMove(px: number, py: number): void;
  applyResize(px: number, py: number): void;
}
