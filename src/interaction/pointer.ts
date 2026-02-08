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
  // 获取画布在页面中的布局矩形。
  const canvasRect = canvas.getBoundingClientRect();
  // 计算相对画布左上角的坐标。
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

    // 确保画布配置与尺寸是最新的。
    ensureCanvasConfigured();

    const pointerPosition = pointerPositionCss(canvas, event);
    const hit = hitTestGlass(
      state.glass,
      pointerPosition.left,
      pointerPosition.top,
      resizeMargin,
    );
    if (!hit.mode) return;

    // 捕获指针，确保拖拽不中断。
    canvas.setPointerCapture(event.pointerId);
    state.startDrag(
      hit.mode,
      event.pointerId,
      pointerPosition.left,
      pointerPosition.top,
      hit.edges,
    );
    updateGlassUi(true);
    // 根据命中结果更新光标样式。
    canvas.style.cursor =
      cursorForHit(hit.mode, hit.edges) || canvas.style.cursor;
    // 阻止默认行为以避免文本选择等。
    event.preventDefault();
    // 请求重绘。
    requestRender();
  };

  // 移动时：未拖拽则更新悬停光标，拖拽中则更新几何状态。
  const onPointerMove = (event: PointerEvent): void => {
    if (stoppedRef.value) return;
    // 计算指针在画布内的位置。
    const pointerPosition = pointerPositionCss(canvas, event);
    // 确保画布配置最新。
    ensureCanvasConfigured();

    if (!state.drag.active) {
      const hit = hitTestGlass(
        state.glass,
        pointerPosition.left,
        pointerPosition.top,
        resizeMargin,
      );
      // 更新光标与 UI 可见状态。
      const cursor = cursorForHit(hit.mode, hit.edges);
      canvas.style.cursor = cursor || "default";
      updateGlassUi(!!hit.mode);
      return;
    }

    // 拖拽中只处理当前指针。
    if (event.pointerId !== state.drag.pointerId) return;
    // 根据模式应用移动或缩放。
    if (state.drag.mode === "move")
      state.applyMove(pointerPosition.left, pointerPosition.top);
    else state.applyResize(pointerPosition.left, pointerPosition.top);

    // 阻止默认行为并重绘。
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
    // 结束拖拽并刷新。
    state.endDrag(event.pointerId);
    requestRender();
  };

  // 丢失 capture 时也要收尾，避免状态卡住。
  const onLostCapture = (event: PointerEvent): void => {
    // 捕获丢失时强制结束拖拽。
    state.endDrag(event.pointerId);
    requestRender();
  };

  // 鼠标离开且未拖拽时，恢复默认视觉状态。
  const onPointerLeave = (): void => {
    if (state.drag.active) return;
    // 退出画布后恢复默认光标并隐藏 UI。
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
    // 移除全部事件监听。
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("lostpointercapture", onLostCapture);
    canvas.removeEventListener("pointerleave", onPointerLeave);
  };
}
