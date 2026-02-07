import { MIN_H, MIN_W, PARAMS, RESIZE_MARGIN } from "./config/params";
import { createRenderer } from "./gpu/renderer";
import { attachPointerHandlers } from "./interaction/pointer";
import wgsl from "./shaders.wgsl?raw";
import { createGlassState } from "./state/glassState";
import type { StoppedRef } from "./types";
import { showFallback } from "./utils/dom";
import { createImageTexture, loadBitmap } from "./utils/image";
import { dprClamped } from "./utils/math";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main(): Promise<void> {
  const log = (...args: unknown[]) => console.log("[webgpu]", ...args);
  log("href =", location.href);
  log("isSecureContext =", window.isSecureContext);
  log("userAgent =", navigator.userAgent);

  const gpu = navigator.gpu;
  log("navigator.gpu =", gpu ?? null);

  if (!gpu) {
    showFallback(
      "navigator.gpu 不存在：通常是未开启 WebGPU 实验特性，或不是安全上下文（需 https:// 或 http://localhost）。",
    );
    return;
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter();
  } catch (err) {
    showFallback(`requestAdapter() 抛错：${errorMessage(err)}`);
    return;
  }

  if (!adapter) {
    showFallback(
      "requestAdapter() 返回 null：通常是 WebGPU 未开启/被策略禁用/不在安全上下文/或系统不支持该实现。",
    );
    return;
  }

  log("adapter =", adapter);
  try {
    log("adapter.features =", [...adapter.features.values()]);
  } catch {
    // ignore
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (err) {
    showFallback(`requestDevice() 抛错：${errorMessage(err)}`);
    return;
  }

  device.lost.then((info) => {
    console.error("[webgpu] device lost:", info);
  });

  const queue = device.queue;

  const canvasEl = document.getElementById("c");
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    showFallback("未找到 #c 画布元素。请确认 index.html 页面结构是否完整。");
    return;
  }
  const canvas = canvasEl;

  const ctx = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!ctx) {
    showFallback(
      "canvas.getContext(webgpu) 返回 null：可能是 WebGPU 未启用，或页面不是安全上下文。",
    );
    return;
  }

  const glassUiNode = document.getElementById("glass-ui");
  const glassUi = glassUiNode instanceof HTMLDivElement ? glassUiNode : null;

  const presentationFormat = gpu.getPreferredCanvasFormat
    ? gpu.getPreferredCanvasFormat()
    : ("bgra8unorm" as GPUTextureFormat);
  log("presentationFormat =", presentationFormat);

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const imgUrl = new URL("./assets/left-image.png", import.meta.url).href;
  log("loading image =", imgUrl);

  const bitmap = await loadBitmap(imgUrl);
  log("image bitmap =", { width: bitmap.width, height: bitmap.height });

  const imageAspect = bitmap.width / Math.max(1, bitmap.height);
  const imageTex = createImageTexture(device, queue, bitmap);

  const shaderModule = device.createShaderModule({ code: wgsl });
  if (typeof shaderModule.getCompilationInfo === "function") {
    try {
      const info = await shaderModule.getCompilationInfo();
      if (info.messages.length > 0) {
        let hasError = false;
        console.groupCollapsed?.("[webgpu] shader compilation info");
        for (const message of info.messages) {
          const where = `line ${message.lineNum}:${message.linePos}`;
          const text = `${message.type.toUpperCase()} ${where} ${message.message}`;
          if (message.type === "error") {
            hasError = true;
            console.error(text);
          } else if (message.type === "warning") {
            console.warn(text);
          } else {
            console.log(text);
          }
        }
        console.groupEnd?.();

        if (hasError) {
          showFallback(
            "WGSL 编译失败：请查看控制台中的 shader compilation info。",
          );
          return;
        }
      } else {
        log("shader compilation info: (no messages)");
      }
    } catch (err) {
      console.warn("[webgpu] getCompilationInfo() failed:", errorMessage(err));
    }
  }

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

  // Render on demand (prevents log/error spam if something goes wrong).
  let rafPending = false;
  const stoppedRef: StoppedRef = { value: false };

  const requestRender = (): void => {
    if (stoppedRef.value || rafPending) return;

    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      try {
        renderer.ensureCanvasConfigured();
        renderer.writeUniforms();
        renderer.render();
      } catch (err) {
        stoppedRef.value = true;
        console.error("[webgpu] render failed:", errorMessage(err));
        showFallback(`渲染失败：${errorMessage(err)}`);
      }
    });
  };

  // If Safari fires a GPU error, stop further renders to avoid spamming the console.
  device.onuncapturederror = (ev) => {
    stoppedRef.value = true;
    const msg = ev.error?.message ?? String(ev.error);
    console.error("[webgpu] uncapturederror:", msg);
    showFallback(`GPU 错误：${msg}`);
  };

  attachPointerHandlers({
    canvas,
    state,
    resizeMargin: RESIZE_MARGIN,
    ensureCanvasConfigured: renderer.ensureCanvasConfigured,
    requestRender,
    updateGlassUi,
    stoppedRef,
  });

  window.addEventListener("resize", requestRender);
  requestRender();
}

main().catch((err: unknown) => {
  console.error(err);
  showFallback(`main() 未捕获异常：${errorMessage(err)}`);
});
