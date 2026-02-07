import { sdRoundRect } from "../utils/math.js";

function pointerPosCss(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function hitTestGlass(glass, px, py, resizeMargin) {
  const cx = glass.xCss + glass.wCss * 0.5;
  const cy = glass.yCss + glass.hCss * 0.5;
  const halfW = glass.wCss * 0.5;
  const halfH = glass.hCss * 0.5;
  const rad = glass.hCss * 0.5;
  const d = sdRoundRect(px - cx, py - cy, halfW, halfH, rad);
  const inside = d <= 0;

  // IMPORTANT:
  // - Move should respect the rounded shape (avoid dragging from transparent corners).
  // - Resize/handles should behave like Figma/Photoshop: use the AABB (square selection box),
  //   otherwise corner handles become unreachable because the rounded-rect SDF is far outside.
  const x1 = glass.xCss;
  const y1 = glass.yCss;
  const x2 = glass.xCss + glass.wCss;
  const y2 = glass.yCss + glass.hCss;
  const dx = Math.max(x1 - px, 0, px - x2);
  const dy = Math.max(y1 - py, 0, py - y2);
  const distRect = Math.hypot(dx, dy);
  const active = distRect <= resizeMargin;

  const dl = px - glass.xCss;
  const dr = glass.xCss + glass.wCss - px;
  const dt = py - glass.yCss;
  const db = glass.yCss + glass.hCss - py;
  const adl = Math.abs(dl);
  const adr = Math.abs(dr);
  const adt = Math.abs(dt);
  const adb = Math.abs(db);

  let nearL = adl < resizeMargin;
  let nearR = adr < resizeMargin;
  if (nearL && nearR) {
    nearL = adl <= adr;
    nearR = !nearL;
  }

  let nearT = adt < resizeMargin;
  let nearB = adb < resizeMargin;
  if (nearT && nearB) {
    nearT = adt <= adb;
    nearB = !nearT;
  }

  const edges = active
    ? { l: nearL, r: nearR, t: nearT, b: nearB }
    : { l: false, r: false, t: false, b: false };
  const wantsResize = active && (nearL || nearR || nearT || nearB);
  const mode = wantsResize ? "resize" : inside ? "move" : null;
  return { mode, edges };
}

function cursorForHit(mode, edges) {
  if (mode === "resize") {
    const { l, r, t, b } = edges;
    if ((l && t) || (r && b)) return "nwse-resize";
    if ((r && t) || (l && b)) return "nesw-resize";
    if (l || r) return "ew-resize";
    if (t || b) return "ns-resize";
  }
  if (mode === "move") return "move";
  return "";
}

export function attachPointerHandlers({
  canvas,
  state,
  resizeMargin,
  ensureCanvasConfigured,
  requestRender,
  updateGlassUi,
  stoppedRef,
}) {
  const onPointerDown = (ev) => {
    if (stoppedRef.value) return;
    if (!ev.isPrimary || ev.button !== 0) return;

    ensureCanvasConfigured();

    const p = pointerPosCss(canvas, ev);
    const hit = hitTestGlass(state.glass, p.x, p.y, resizeMargin);
    if (!hit.mode) return;

    canvas.setPointerCapture(ev.pointerId);
    state.startDrag(hit.mode, ev.pointerId, p.x, p.y, hit.edges);
    updateGlassUi(true);
    canvas.style.cursor = cursorForHit(hit.mode, hit.edges) || canvas.style.cursor;
    ev.preventDefault();
    requestRender();
  };

  const onPointerMove = (ev) => {
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

  const onPointerUp = (ev) => {
    try {
      if (canvas.hasPointerCapture?.(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
    state.endDrag(ev.pointerId);
    requestRender();
  };

  const onLostCapture = (ev) => {
    state.endDrag(ev.pointerId);
    requestRender();
  };

  const onPointerLeave = () => {
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
