import { bootstrapWebGpuApp } from "./app/bootstrap";
import { createRuntime } from "./app/runtime";
import { MIN_HEIGHT, MIN_WIDTH, PARAMS, RESIZE_MARGIN } from "./config/params";
import { createRenderer } from "./gpu/renderer";
import { attachPointerHandlers } from "./interaction/pointer";
import { createGlassState } from "./state/glassState";
import { showFallback } from "./utils/dom";
import { devicePixelRatioClamped } from "./utils/math";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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

  // Surface any validation errors (Safari sometimes does not show these clearly otherwise).
  device.pushErrorScope("validation");
  device.pushErrorScope("out-of-memory");

  const state = createGlassState({ minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT });
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

  // Pop error scopes after pipeline creation.
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

main().catch((err: unknown) => {
  console.error(err);
  showFallback(`main() 未捕获异常：${errorMessage(err)}`);
});
