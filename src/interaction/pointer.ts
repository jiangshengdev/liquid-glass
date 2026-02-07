import type { PointerHandlersDeps } from "../types";
import { cursorForHit, hitTestGlass } from "./hitTest";

function pointerPosCss(
  canvas: HTMLCanvasElement,
  ev: PointerEvent,
): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
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
  const onPointerDown = (ev: PointerEvent): void => {
    if (stoppedRef.value) return;
    if (!ev.isPrimary || ev.button !== 0) return;

    ensureCanvasConfigured();

    const p = pointerPosCss(canvas, ev);
    const hit = hitTestGlass(state.glass, p.x, p.y, resizeMargin);
    if (!hit.mode) return;

    canvas.setPointerCapture(ev.pointerId);
    state.startDrag(hit.mode, ev.pointerId, p.x, p.y, hit.edges);
    updateGlassUi(true);
    canvas.style.cursor =
      cursorForHit(hit.mode, hit.edges) || canvas.style.cursor;
    ev.preventDefault();
    requestRender();
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (stoppedRef.value) return;
    const p = pointerPosCss(canvas, ev);
    ensureCanvasConfigured();

    if (!state.drag.active) {
      const hit = hitTestGlass(state.glass, p.x, p.y, resizeMargin);
      const c = cursorForHit(hit.mode, hit.edges);
      canvas.style.cursor = c || "default";
      updateGlassUi(!!hit.mode);
      return;
    }

    if (ev.pointerId !== state.drag.pointerId) return;
    if (state.drag.mode === "move") state.applyMove(p.x, p.y);
    else state.applyResize(p.x, p.y);

    ev.preventDefault();
    requestRender();
  };

  const onPointerUp = (ev: PointerEvent): void => {
    try {
      if (canvas.hasPointerCapture(ev.pointerId))
        canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
    state.endDrag(ev.pointerId);
    requestRender();
  };

  const onLostCapture = (ev: PointerEvent): void => {
    state.endDrag(ev.pointerId);
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
