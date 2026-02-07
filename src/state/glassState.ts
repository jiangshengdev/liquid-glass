import type {
  CanvasState,
  DragMode,
  DragState,
  GlassRect,
  GlassState,
  ResizeEdges,
} from "../types";
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
    pxW: 0,
    pxH: 0,
    dpr: 1,
    cssW: 0,
    cssH: 0,
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
    l: false,
    r: false,
    t: false,
    b: false,
  };

  function initGlassDefault(cssW: number, cssH: number): void {
    const w = Math.min(cssW * 0.8, 920);
    const h = Math.min(cssH * 0.32, 280);
    glass.wCss = Math.max(minW, Math.min(cssW, w));
    glass.hCss = Math.max(minH, Math.min(cssH, h));
    // Keep a horizontal capsule by default.
    glass.wCss = Math.max(glass.wCss, glass.hCss);
    glass.xCss = (cssW - glass.wCss) * 0.5;
    glass.yCss = (cssH - glass.hCss) * 0.5;
    glassInited = true;
  }

  function clampGlass(cssW: number, cssH: number): void {
    glass.wCss = clamp(glass.wCss, minW, Math.max(minW, cssW));
    glass.hCss = clamp(glass.hCss, minH, Math.max(minH, cssH));
    // Capsule constraint: radius = height/2 => height should not exceed width.
    glass.hCss = Math.min(glass.hCss, glass.wCss);
    glass.xCss = clamp(glass.xCss, 0, Math.max(0, cssW - glass.wCss));
    glass.yCss = clamp(glass.yCss, 0, Math.max(0, cssH - glass.hCss));
  }

  function updateCanvasState({
    pxW,
    pxH,
    dpr,
    cssW,
    cssH,
  }: CanvasState): boolean {
    const changed =
      pxW !== canvas.pxW || pxH !== canvas.pxH || dpr !== canvas.dpr;
    canvas.pxW = pxW;
    canvas.pxH = pxH;
    canvas.dpr = dpr;
    canvas.cssW = cssW;
    canvas.cssH = cssH;

    if (!glassInited) initGlassDefault(cssW, cssH);
    clampGlass(cssW, cssH);
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
    drag.l = !!edges?.l;
    drag.r = !!edges?.r;
    drag.t = !!edges?.t;
    drag.b = !!edges?.b;
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
    clampGlass(canvas.cssW, canvas.cssH);
  }

  function applyResize(px: number, py: number): void {
    const dx = px - drag.startPx;
    const dy = py - drag.startPy;

    let x1 = drag.startX;
    let y1 = drag.startY;
    let x2 = drag.startX + drag.startW;
    let y2 = drag.startY + drag.startH;

    if (drag.l) x1 += dx;
    if (drag.r) x2 += dx;
    if (drag.t) y1 += dy;
    if (drag.b) y2 += dy;

    // Min size.
    if (x2 - x1 < minW) {
      if (drag.l && !drag.r) x1 = x2 - minW;
      else x2 = x1 + minW;
    }
    if (y2 - y1 < minH) {
      if (drag.t && !drag.b) y1 = y2 - minH;
      else y2 = y1 + minH;
    }

    // Clamp to canvas bounds (prefer clamping the dragged edge).
    if (drag.l && !drag.r) {
      x1 = clamp(x1, 0, x2 - minW);
    } else if (drag.r && !drag.l) {
      x2 = clamp(x2, x1 + minW, canvas.cssW);
    } else {
      const w = x2 - x1;
      x1 = clamp(x1, 0, Math.max(0, canvas.cssW - w));
      x2 = x1 + w;
    }

    if (drag.t && !drag.b) {
      y1 = clamp(y1, 0, y2 - minH);
    } else if (drag.b && !drag.t) {
      y2 = clamp(y2, y1 + minH, canvas.cssH);
    } else {
      const h = y2 - y1;
      y1 = clamp(y1, 0, Math.max(0, canvas.cssH - h));
      y2 = y1 + h;
    }

    // Capsule constraint: keep height <= width (so radius = height/2 stays valid).
    const w = x2 - x1;
    let h = y2 - y1;
    if (h > w) {
      const newH = w;
      if (drag.t && !drag.b) y1 = y2 - newH;
      else if (drag.b && !drag.t) y2 = y1 + newH;
      else {
        const cy = (y1 + y2) * 0.5;
        y1 = cy - newH * 0.5;
        y2 = y1 + newH;
      }
      if (y1 < 0) {
        y1 = 0;
        y2 = newH;
      }
      if (y2 > canvas.cssH) {
        y2 = canvas.cssH;
        y1 = y2 - newH;
      }
      h = y2 - y1;
    }

    glass.xCss = x1;
    glass.yCss = y1;
    glass.wCss = x2 - x1;
    glass.hCss = h;
    clampGlass(canvas.cssW, canvas.cssH);
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
