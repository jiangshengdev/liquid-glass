import { bootstrapWebGpuApp } from "./app/bootstrap";
import { createRuntime } from "./app/runtime";
import { MIN_HEIGHT, MIN_WIDTH, PARAMS, RESIZE_MARGIN } from "./config/params";
import { createRenderer } from "./gpu/renderer";
import { attachPointerHandlers } from "./interaction/pointer";
import { createGlassState } from "./state/glass-state";
import { showFallback } from "./utils/dom";
import { devicePixelRatioClamped } from "./utils/math";

/**
 * 统一格式化未知异常，便于在日志与回退面板中展示。
 * @param err 未知异常对象。
 * @returns 可直接展示的错误文本。
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 应用主入口：完成 WebGPU 初始化、渲染器组装、交互绑定与首帧调度。
 * @returns 无返回值，失败时通过回退 UI 呈现错误。
 */
async function main(): Promise<void> {
  const bootstrapResult = await bootstrapWebGpuApp();
  if (!bootstrapResult) return;

  const {
    log,
    device,
    queue,
    canvas,
    canvasContext,
    glassUi,
    presentationFormat,
    sampler,
    imageTexture,
    imageAspect,
    shaderModule,
  } = bootstrapResult;

  // 先压入错误作用域，捕获管线创建阶段的校验与内存错误。
  // Safari 某些版本默认日志不完整，这里主动兜底。
  device.pushErrorScope("validation");
  device.pushErrorScope("out-of-memory");

  const state = createGlassState({
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
  });

  // 将状态层中的玻璃矩形同步到 DOM 辅助框。
  const updateGlassUi = (visible?: boolean): void => {
    if (!glassUi) return;
    if (typeof visible === "boolean") glassUi.hidden = !visible;
    if (glassUi.hidden) return;

    glassUi.style.left = `${state.glass.left}px`;
    glassUi.style.top = `${state.glass.top}px`;
    glassUi.style.width = `${state.glass.width}px`;
    glassUi.style.height = `${state.glass.height}px`;
  };

  const renderer = createRenderer({
    device,
    queue,
    canvas,
    canvasContext,
    sampler,
    imageTexture,
    module: shaderModule,
    presentationFormat,
    imageAspect,
    state,
    params: PARAMS,
    devicePixelRatioClamped,
    log,
    updateGlassUi,
    isGlassUiHidden: () => !!glassUi?.hidden,
  });

  // 管线初始化完成后，按压栈顺序弹出错误作用域。
  {
    const oomError = await device.popErrorScope();
    const validationError = await device.popErrorScope();

    if (oomError) console.error("[webgpu] OOM error:", oomError);
    if (validationError)
      console.error("[webgpu] Validation error:", validationError);

    if (oomError || validationError) {
      const validationFailureMessage =
        (validationError ?? oomError)?.message ??
        String(validationError ?? oomError);
      showFallback(`GPU 校验失败：${validationFailureMessage}`);
      return;
    }
  }

  const runtime = createRuntime({ device, renderer });

  const disposePointerHandlers = attachPointerHandlers({
    canvas,
    state,
    resizeMargin: RESIZE_MARGIN,
    ensureCanvasConfigured: renderer.ensureCanvasConfigured,
    requestRender: runtime.requestRender,
    updateGlassUi,
    stoppedRef: runtime.stoppedRef,
  });
  runtime.addCleanup(disposePointerHandlers);

  runtime.requestRender();
}

// 主流程兜底：任何未捕获异常都进入回退展示。
main().catch((err: unknown) => {
  console.error(err);
  showFallback(`main() 未捕获异常：${errorMessage(err)}`);
});
