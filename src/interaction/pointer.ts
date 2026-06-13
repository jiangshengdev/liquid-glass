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
 * 绑定画布指针事件，处理拖拽移动、缩放与背景拖动箭头偏移。
 * @param deps 交互依赖。
 * @returns 解绑函数。
 */
export function attachPointerHandlers({
  canvas,
  glassHitLayer,
  state,
  resizeMargin,
  ensureCanvasConfigured,
  requestRender,
  updateGlassUi,
  isRefractionDebugVisible,
  stoppedRef,
}: PointerHandlersDeps): () => void {
  const updateHoverState = (
    target: HTMLElement,
    pointerLeft: number,
    pointerTop: number,
    allowBackgroundDrag: boolean,
  ): void => {
    const hit = hitTestGlass(
      state.glass,
      pointerLeft,
      pointerTop,
      resizeMargin,
    );
    if (hit.mode) {
      target.style.cursor = cursorForHit(hit.mode, hit.edges) || "default";
      updateGlassUi(true);
      return;
    }

    if (allowBackgroundDrag && isRefractionDebugVisible()) {
      target.style.cursor = cursorForHit("background", hit.edges) || "grab";
    } else {
      target.style.cursor = "default";
    }
    updateGlassUi(false);
  };

  // 按下时：命中检测并进入拖拽状态。
  const onPointerDown = (
    target: HTMLElement,
    allowBackgroundDrag: boolean,
    event: PointerEvent,
  ): void => {
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
    const dragMode =
      hit.mode ??
      (allowBackgroundDrag && isRefractionDebugVisible() ? "background" : null);
    if (!dragMode) return;

    // 捕获指针，确保拖拽不中断。
    target.setPointerCapture(event.pointerId);
    state.startDrag(
      dragMode,
      event.pointerId,
      pointerPosition.left,
      pointerPosition.top,
      hit.edges,
    );

    if (dragMode === "background") {
      updateGlassUi(false);
      target.style.cursor = "grabbing";
    } else {
      updateGlassUi(true);
      target.style.cursor =
        cursorForHit(dragMode, hit.edges) || target.style.cursor;
    }

    // 阻止默认行为以避免文本选择等。
    event.preventDefault();
    // 请求重绘。
    requestRender();
  };

  // 移动时：未拖拽则更新悬停光标，拖拽中则更新几何状态。
  const onPointerMove = (
    target: HTMLElement,
    allowBackgroundDrag: boolean,
    event: PointerEvent,
  ): void => {
    if (stoppedRef.value) return;
    // 计算指针在画布内的位置。
    const pointerPosition = pointerPositionCss(canvas, event);
    // 确保画布配置最新。
    ensureCanvasConfigured();

    if (!state.drag.active) {
      updateHoverState(
        target,
        pointerPosition.left,
        pointerPosition.top,
        allowBackgroundDrag,
      );
      return;
    }

    // 拖拽中只处理当前指针。
    if (event.pointerId !== state.drag.pointerId) return;
    // 根据模式应用移动、缩放或背景偏移。
    if (state.drag.mode === "move") {
      state.applyMove(pointerPosition.left, pointerPosition.top);
      target.style.cursor = "move";
      updateGlassUi(true);
    } else if (state.drag.mode === "resize") {
      state.applyResize(pointerPosition.left, pointerPosition.top);
      target.style.cursor =
        cursorForHit(state.drag.mode, state.drag) || target.style.cursor;
      updateGlassUi(true);
    } else {
      state.applyBackgroundDrag(pointerPosition.left, pointerPosition.top);
      target.style.cursor = "grabbing";
      updateGlassUi(false);
    }

    // 阻止默认行为并重绘。
    event.preventDefault();
    requestRender();
  };

  // 抬起/取消时：退出拖拽并触发一次重绘。
  const onPointerUp = (
    target: HTMLElement,
    allowBackgroundDrag: boolean,
    event: PointerEvent,
  ): void => {
    try {
      if (target.hasPointerCapture(event.pointerId))
        target.releasePointerCapture(event.pointerId);
    } catch {
      // 某些浏览器在竞争态下会抛错，忽略即可。
    }
    // 结束拖拽并刷新。
    state.endDrag(event.pointerId);
    const pointerPosition = pointerPositionCss(canvas, event);
    updateHoverState(
      target,
      pointerPosition.left,
      pointerPosition.top,
      allowBackgroundDrag,
    );
    requestRender();
  };

  // 丢失 capture 时也要收尾，避免状态卡住。
  const onLostCapture = (target: HTMLElement, event: PointerEvent): void => {
    // 捕获丢失时强制结束拖拽。
    state.endDrag(event.pointerId);
    target.style.cursor = "default";
    requestRender();
  };

  // 鼠标离开且未拖拽时，恢复默认视觉状态。
  const onPointerLeave = (target: HTMLElement): void => {
    if (state.drag.active) return;
    // 退出画布后恢复默认光标并隐藏 UI。
    target.style.cursor = "default";
    updateGlassUi(false);
  };

  const bindPointerTarget = (
    target: HTMLElement,
    allowBackgroundDrag: boolean,
  ): (() => void) => {
    const handlePointerDown = (event: PointerEvent): void =>
      onPointerDown(target, allowBackgroundDrag, event);
    const handlePointerMove = (event: PointerEvent): void =>
      onPointerMove(target, allowBackgroundDrag, event);
    const handlePointerUp = (event: PointerEvent): void =>
      onPointerUp(target, allowBackgroundDrag, event);
    const handleLostCapture = (event: PointerEvent): void =>
      onLostCapture(target, event);
    const handlePointerLeave = (): void => onPointerLeave(target);

    target.addEventListener("pointerdown", handlePointerDown, {
      passive: false,
    });
    target.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    target.addEventListener("pointerup", handlePointerUp, { passive: false });
    target.addEventListener("pointercancel", handlePointerUp, {
      passive: false,
    });
    target.addEventListener("lostpointercapture", handleLostCapture);
    target.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      target.removeEventListener("pointerdown", handlePointerDown);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerUp);
      target.removeEventListener("pointercancel", handlePointerUp);
      target.removeEventListener("lostpointercapture", handleLostCapture);
      target.removeEventListener("pointerleave", handlePointerLeave);
    };
  };

  const cleanupCanvas = bindPointerTarget(canvas, true);
  const cleanupGlassHitLayer = glassHitLayer
    ? bindPointerTarget(glassHitLayer, false)
    : null;

  return () => {
    // 移除全部事件监听。
    cleanupCanvas();
    cleanupGlassHitLayer?.();
  };
}
