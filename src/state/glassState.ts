import type { CanvasState, DragState, GlassState } from "../types/state";
import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { clamp } from "../utils/math";

interface CreateGlassStateOptions {
  minW: number;
  minH: number;
}

export function createGlassState({
  minW,
  minH,
}: CreateGlassStateOptions): GlassState {
  // Persistent glass rect (CSS px) so resizing the window does not reset placement.
  const glass: GlassRect = { xCss: 0, yCss: 0, wCss: 0, hCss: 0 };
  let glassInited = false;

  const canvas: CanvasState = {
    pixelWidth: 0,
    pixelHeight: 0,
    dpr: 1,
    cssWidth: 0,
    cssHeight: 0,
  };

  const drag: DragState = {
    active: false,
    mode: "move",
    pointerId: -1,
    startPx: 0,
    startPy: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    left: false,
    right: false,
    top: false,
    bottom: false,
  };

  function initGlassDefault(cssWidth: number, cssHeight: number): void {
    const nextWidth = Math.min(cssWidth * 0.8, 920);
    const nextHeight = Math.min(cssHeight * 0.32, 280);
    glass.wCss = Math.max(minW, Math.min(cssWidth, nextWidth));
    glass.hCss = Math.max(minH, Math.min(cssHeight, nextHeight));
    // Keep a horizontal capsule by default.
    glass.wCss = Math.max(glass.wCss, glass.hCss);
    glass.xCss = (cssWidth - glass.wCss) * 0.5;
    glass.yCss = (cssHeight - glass.hCss) * 0.5;
    glassInited = true;
  }

  function clampGlass(cssWidth: number, cssHeight: number): void {
    glass.wCss = clamp(glass.wCss, minW, Math.max(minW, cssWidth));
    glass.hCss = clamp(glass.hCss, minH, Math.max(minH, cssHeight));
    // Capsule constraint: radius = height/2 => height should not exceed width.
    glass.hCss = Math.min(glass.hCss, glass.wCss);
    glass.xCss = clamp(glass.xCss, 0, Math.max(0, cssWidth - glass.wCss));
    glass.yCss = clamp(glass.yCss, 0, Math.max(0, cssHeight - glass.hCss));
  }

  function updateCanvasState({
    pixelWidth,
    pixelHeight,
    dpr,
    cssWidth,
    cssHeight,
  }: CanvasState): boolean {
    const changed =
      pixelWidth !== canvas.pixelWidth ||
      pixelHeight !== canvas.pixelHeight ||
      dpr !== canvas.dpr;
    canvas.pixelWidth = pixelWidth;
    canvas.pixelHeight = pixelHeight;
    canvas.dpr = dpr;
    canvas.cssWidth = cssWidth;
    canvas.cssHeight = cssHeight;

    if (!glassInited) initGlassDefault(cssWidth, cssHeight);
    clampGlass(cssWidth, cssHeight);
    return changed;
  }

  function startDrag(
    mode: DragMode,
    pointerId: number,
    px: number,
    py: number,
    edges?: Partial<ResizeEdges>,
  ): void {
    drag.active = true;
    drag.mode = mode;
    drag.pointerId = pointerId;
    drag.startPx = px;
    drag.startPy = py;
    drag.startX = glass.xCss;
    drag.startY = glass.yCss;
    drag.startW = glass.wCss;
    drag.startH = glass.hCss;
    drag.left = !!edges?.left;
    drag.right = !!edges?.right;
    drag.top = !!edges?.top;
    drag.bottom = !!edges?.bottom;
  }

  function endDrag(pointerId: number): void {
    if (!drag.active || pointerId !== drag.pointerId) return;
    drag.active = false;
    drag.pointerId = -1;
  }

  function applyMove(px: number, py: number): void {
    const dx = px - drag.startPx;
    const dy = py - drag.startPy;
    glass.xCss = drag.startX + dx;
    glass.yCss = drag.startY + dy;
    clampGlass(canvas.cssWidth, canvas.cssHeight);
  }

  function applyResize(px: number, py: number): void {
    const dx = px - drag.startPx;
    const dy = py - drag.startPy;

    let x1 = drag.startX;
    let y1 = drag.startY;
    let x2 = drag.startX + drag.startW;
    let y2 = drag.startY + drag.startH;

    if (drag.left) x1 += dx;
    if (drag.right) x2 += dx;
    if (drag.top) y1 += dy;
    if (drag.bottom) y2 += dy;

    // Min size.
    if (x2 - x1 < minW) {
      if (drag.left && !drag.right) x1 = x2 - minW;
      else x2 = x1 + minW;
    }
    if (y2 - y1 < minH) {
      if (drag.top && !drag.bottom) y1 = y2 - minH;
      else y2 = y1 + minH;
    }

    // Clamp to canvas bounds (prefer clamping the dragged edge).
    if (drag.left && !drag.right) {
      x1 = clamp(x1, 0, x2 - minW);
    } else if (drag.right && !drag.left) {
      x2 = clamp(x2, x1 + minW, canvas.cssWidth);
    } else {
      const nextWidth = x2 - x1;
      x1 = clamp(x1, 0, Math.max(0, canvas.cssWidth - nextWidth));
      x2 = x1 + nextWidth;
    }

    if (drag.top && !drag.bottom) {
      y1 = clamp(y1, 0, y2 - minH);
    } else if (drag.bottom && !drag.top) {
      y2 = clamp(y2, y1 + minH, canvas.cssHeight);
    } else {
      const nextHeight = y2 - y1;
      y1 = clamp(y1, 0, Math.max(0, canvas.cssHeight - nextHeight));
      y2 = y1 + nextHeight;
    }

    // Capsule constraint: keep height <= width (so radius = height/2 stays valid).
    const nextWidth = x2 - x1;
    let nextHeight = y2 - y1;
    if (nextHeight > nextWidth) {
      const constrainedHeight = nextWidth;
      if (drag.top && !drag.bottom) y1 = y2 - constrainedHeight;
      else if (drag.bottom && !drag.top) y2 = y1 + constrainedHeight;
      else {
        const centerY = (y1 + y2) * 0.5;
        y1 = centerY - constrainedHeight * 0.5;
        y2 = y1 + constrainedHeight;
      }
      if (y1 < 0) {
        y1 = 0;
        y2 = constrainedHeight;
      }
      if (y2 > canvas.cssHeight) {
        y2 = canvas.cssHeight;
        y1 = y2 - constrainedHeight;
      }
      nextHeight = y2 - y1;
    }

    glass.xCss = x1;
    glass.yCss = y1;
    glass.wCss = x2 - x1;
    glass.hCss = nextHeight;
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
