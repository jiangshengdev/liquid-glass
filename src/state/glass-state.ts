import type { CanvasState, DragState, GlassState } from "../types/state";
import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { clamp } from "../utils/math";

interface CreateGlassStateOptions {
  minWidth: number;
  minHeight: number;
}

export function createGlassState({
  minWidth,
  minHeight,
}: CreateGlassStateOptions): GlassState {
  // Persistent glass rect (CSS pixels) so resizing the window does not reset placement.
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

  function initGlassDefault(cssWidth: number, cssHeight: number): void {
    const nextWidth = Math.min(cssWidth * 0.8, 920);
    const nextHeight = Math.min(cssHeight * 0.32, 280);
    glass.width = Math.max(minWidth, Math.min(cssWidth, nextWidth));
    glass.height = Math.max(minHeight, Math.min(cssHeight, nextHeight));
    // Keep a horizontal capsule by default.
    glass.width = Math.max(glass.width, glass.height);
    glass.left = (cssWidth - glass.width) * 0.5;
    glass.top = (cssHeight - glass.height) * 0.5;
    glassInited = true;
  }

  function clampGlass(cssWidth: number, cssHeight: number): void {
    glass.width = clamp(glass.width, minWidth, Math.max(minWidth, cssWidth));
    glass.height = clamp(
      glass.height,
      minHeight,
      Math.max(minHeight, cssHeight),
    );
    // Capsule constraint: radius = height/2 => height should not exceed width.
    glass.height = Math.min(glass.height, glass.width);
    glass.left = clamp(glass.left, 0, Math.max(0, cssWidth - glass.width));
    glass.top = clamp(glass.top, 0, Math.max(0, cssHeight - glass.height));
  }

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

  function endDrag(pointerId: number): void {
    if (!drag.active || pointerId !== drag.pointerId) return;
    drag.active = false;
    drag.pointerId = -1;
  }

  function applyMove(pointerLeft: number, pointerTop: number): void {
    const deltaLeft = pointerLeft - drag.startPointerLeft;
    const deltaTop = pointerTop - drag.startPointerTop;
    glass.left = drag.startLeft + deltaLeft;
    glass.top = drag.startTop + deltaTop;
    clampGlass(canvas.cssWidth, canvas.cssHeight);
  }

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

    // Min size.
    if (right - left < minWidth) {
      if (drag.left && !drag.right) left = right - minWidth;
      else right = left + minWidth;
    }
    if (bottom - top < minHeight) {
      if (drag.top && !drag.bottom) top = bottom - minHeight;
      else bottom = top + minHeight;
    }

    // Clamp to canvas bounds (prefer clamping the dragged edge).
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

    // Capsule constraint: keep height <= width (so radius = height/2 stays valid).
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
