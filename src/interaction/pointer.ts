import type { PointerHandlersDeps } from "../types/interaction";
import { cursorForHit, hitTestGlass } from "./hitTest";

function pointerPosCss(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { x: number; y: number } {
  const canvasRect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  };
}

export function attachPointerHandlers({
  canvas,
  state,
  resizeMargin,
  ensureCanvasConfigured,
  requestRender,
  updateGlassUi,
  stoppedRef,
}: PointerHandlersDeps): () => void {
  const onPointerDown = (event: PointerEvent): void => {
    if (stoppedRef.value) return;
    if (!event.isPrimary || event.button !== 0) return;

    ensureCanvasConfigured();

    const pointerPosition = pointerPosCss(canvas, event);
    const hit = hitTestGlass(
      state.glass,
      pointerPosition.x,
      pointerPosition.y,
      resizeMargin,
    );
    if (!hit.mode) return;

    canvas.setPointerCapture(event.pointerId);
    state.startDrag(
      hit.mode,
      event.pointerId,
      pointerPosition.x,
      pointerPosition.y,
      hit.edges,
    );
    updateGlassUi(true);
    canvas.style.cursor =
      cursorForHit(hit.mode, hit.edges) || canvas.style.cursor;
    event.preventDefault();
    requestRender();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (stoppedRef.value) return;
    const pointerPosition = pointerPosCss(canvas, event);
    ensureCanvasConfigured();

    if (!state.drag.active) {
      const hit = hitTestGlass(
        state.glass,
        pointerPosition.x,
        pointerPosition.y,
        resizeMargin,
      );
      const cursor = cursorForHit(hit.mode, hit.edges);
      canvas.style.cursor = cursor || "default";
      updateGlassUi(!!hit.mode);
      return;
    }

    if (event.pointerId !== state.drag.pointerId) return;
    if (state.drag.mode === "move")
      state.applyMove(pointerPosition.x, pointerPosition.y);
    else state.applyResize(pointerPosition.x, pointerPosition.y);

    event.preventDefault();
    requestRender();
  };

  const onPointerUp = (event: PointerEvent): void => {
    try {
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    state.endDrag(event.pointerId);
    requestRender();
  };

  const onLostCapture = (event: PointerEvent): void => {
    state.endDrag(event.pointerId);
    requestRender();
  };

  const onPointerLeave = (): void => {
    if (state.drag.active) return;
    canvas.style.cursor = "default";
    updateGlassUi(false);
  };

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("lostpointercapture", onLostCapture);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("lostpointercapture", onLostCapture);
    canvas.removeEventListener("pointerleave", onPointerLeave);
  };
}
