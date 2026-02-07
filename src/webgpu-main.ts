import { bootstrapWebGpuApp } from "./app/bootstrap";
import { createRuntime } from "./app/runtime";
import { MIN_H, MIN_W, PARAMS, RESIZE_MARGIN } from "./config/params";
import { createRenderer } from "./gpu/renderer";
import { attachPointerHandlers } from "./interaction/pointer";
import { createGlassState } from "./state/glassState";
import { showFallback } from "./utils/dom";
import { dprClamped } from "./utils/math";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const boot = await bootstrapWebGpuApp();
  if (!boot) return;

  const {
    log,
    device,
    queue,
    canvas,
    ctx,
    glassUi,
    presentationFormat,
    sampler,
    imageTex,
    imageAspect,
    shaderModule,
  } = boot;

  // Surface any validation errors (Safari sometimes does not show these clearly otherwise).
  device.pushErrorScope("validation");
  device.pushErrorScope("out-of-memory");

  const state = createGlassState({ minW: MIN_W, minH: MIN_H });
  const updateGlassUi = (visible?: boolean): void => {
    if (!glassUi) return;
    if (typeof visible === "boolean") glassUi.hidden = !visible;
    if (glassUi.hidden) return;

    glassUi.style.left = `${state.glass.xCss}px`;
    glassUi.style.top = `${state.glass.yCss}px`;
    glassUi.style.width = `${state.glass.wCss}px`;
    glassUi.style.height = `${state.glass.hCss}px`;
  };

  const renderer = createRenderer({
    device,
    queue,
    canvas,
    ctx,
    sampler,
    imageTex,
    module: shaderModule,
    presentationFormat,
    imageAspect,
    state,
    params: PARAMS,
    dprClamped,
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
      const msg =
        (validationError ?? oomError)?.message ??
        String(validationError ?? oomError);
      showFallback(`GPU 校验失败：${msg}`);
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
