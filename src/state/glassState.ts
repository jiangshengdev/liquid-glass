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
    const deltaX = px - drag.startPx;
    const deltaY = py - drag.startPy;
    glass.xCss = drag.startX + deltaX;
    glass.yCss = drag.startY + deltaY;
    clampGlass(canvas.cssWidth, canvas.cssHeight);
  }

  function applyResize(px: number, py: number): void {
    const deltaX = px - drag.startPx;
    const deltaY = py - drag.startPy;

    let left = drag.startX;
    let top = drag.startY;
    let right = drag.startX + drag.startW;
    let bottom = drag.startY + drag.startH;

    if (drag.left) left += deltaX;
    if (drag.right) right += deltaX;
    if (drag.top) top += deltaY;
    if (drag.bottom) bottom += deltaY;

    // Min size.
    if (right - left < minW) {
      if (drag.left && !drag.right) left = right - minW;
      else right = left + minW;
    }
    if (bottom - top < minH) {
      if (drag.top && !drag.bottom) top = bottom - minH;
      else bottom = top + minH;
    }

    // Clamp to canvas bounds (prefer clamping the dragged edge).
    if (drag.left && !drag.right) {
      left = clamp(left, 0, right - minW);
    } else if (drag.right && !drag.left) {
      right = clamp(right, left + minW, canvas.cssWidth);
    } else {
      const nextWidth = right - left;
      left = clamp(left, 0, Math.max(0, canvas.cssWidth - nextWidth));
      right = left + nextWidth;
    }

    if (drag.top && !drag.bottom) {
      top = clamp(top, 0, bottom - minH);
    } else if (drag.bottom && !drag.top) {
      bottom = clamp(bottom, top + minH, canvas.cssHeight);
    } else {
      const nextHeight = bottom - top;
      top = clamp(top, 0, Math.max(0, canvas.cssHeight - nextHeight));
      bottom = top + nextHeight;
    }

    // Capsule constraint: keep height <= width (so radius = height/2 stays valid).
    const nextWidth = right - left;
    let nextHeight = bottom - top;
    if (nextHeight > nextWidth) {
      const constrainedHeight = nextWidth;
      if (drag.top && !drag.bottom) top = bottom - constrainedHeight;
      else if (drag.bottom && !drag.top) bottom = top + constrainedHeight;
      else {
        const centerY = (top + bottom) * 0.5;
        top = centerY - constrainedHeight * 0.5;
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

    glass.xCss = left;
    glass.yCss = top;
    glass.wCss = right - left;
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
