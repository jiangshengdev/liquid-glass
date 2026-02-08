import type { PointerHandlersDeps } from "../types/interaction";
import { cursorForHit, hitTestGlass } from "./hit-test";

/**
 * 将 PointerEvent 坐标转换为相对画布左上角的 CSS 像素坐标。
 * @param canvas 目标画布。
 * @param event 指针事件。
 * @returns 画布内坐标。
 */
function pointerPositionCss(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): { left: number; top: number } {
  const canvasRect = canvas.getBoundingClientRect();
  return {
    left: event.clientX - canvasRect.left,
    top: event.clientY - canvasRect.top,
  };
}

/**
 * 绑定画布指针事件，处理拖拽移动与缩放。
 * @param deps 交互依赖。
 * @returns 解绑函数。
 */
export function attachPointerHandlers({
  canvas,
  state,
  resizeMargin,
  ensureCanvasConfigured,
  requestRender,
  updateGlassUi,
  stoppedRef,
}: PointerHandlersDeps): () => void {
  // 按下时：命中检测并进入拖拽状态。
  const onPointerDown = (event: PointerEvent): void => {
    if (stoppedRef.value) return;
    if (!event.isPrimary || event.button !== 0) return;

    ensureCanvasConfigured();

    const pointerPosition = pointerPositionCss(canvas, event);
    const hit = hitTestGlass(
      state.glass,
      pointerPosition.left,
      pointerPosition.top,
      resizeMargin,
    );
    if (!hit.mode) return;

    canvas.setPointerCapture(event.pointerId);
    state.startDrag(
      hit.mode,
      event.pointerId,
      pointerPosition.left,
      pointerPosition.top,
      hit.edges,
    );
    updateGlassUi(true);
    canvas.style.cursor =
      cursorForHit(hit.mode, hit.edges) || canvas.style.cursor;
    event.preventDefault();
    requestRender();
  };

  // 移动时：未拖拽则更新悬停光标，拖拽中则更新几何状态。
  const onPointerMove = (event: PointerEvent): void => {
    if (stoppedRef.value) return;
    const pointerPosition = pointerPositionCss(canvas, event);
    ensureCanvasConfigured();

    if (!state.drag.active) {
      const hit = hitTestGlass(
        state.glass,
        pointerPosition.left,
        pointerPosition.top,
        resizeMargin,
      );
      const cursor = cursorForHit(hit.mode, hit.edges);
      canvas.style.cursor = cursor || "default";
      updateGlassUi(!!hit.mode);
      return;
    }

    if (event.pointerId !== state.drag.pointerId) return;
    if (state.drag.mode === "move")
      state.applyMove(pointerPosition.left, pointerPosition.top);
    else state.applyResize(pointerPosition.left, pointerPosition.top);

    event.preventDefault();
    requestRender();
  };

  // 抬起/取消时：退出拖拽并触发一次重绘。
  const onPointerUp = (event: PointerEvent): void => {
    try {
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    } catch {
      // 某些浏览器在竞争态下会抛错，忽略即可。
    }
    state.endDrag(event.pointerId);
    requestRender();
  };

  // 丢失 capture 时也要收尾，避免状态卡住。
  const onLostCapture = (event: PointerEvent): void => {
    state.endDrag(event.pointerId);
    requestRender();
  };

  // 鼠标离开且未拖拽时，恢复默认视觉状态。
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
