import wgsl from "./shaders.wgsl?raw";
import { loadBitmap, createImageTexture } from "./utils/image.js";
import { PARAMS, MIN_W, MIN_H, RESIZE_MARGIN } from "./config/params.js";
import { createRenderer } from "./gpu/renderer.js";
import { attachPointerHandlers } from "./interaction/pointer.js";
import { createGlassState } from "./state/glassState.js";
import { showFallback } from "./utils/dom.js";
import { dprClamped } from "./utils/math.js";

async function main() {
  const log = (...args) => console.log("[webgpu]", ...args);
  log("href =", location.href);
  log("isSecureContext =", window.isSecureContext);
  log("userAgent =", navigator.userAgent);
  log("navigator.gpu =", "gpu" in navigator ? navigator.gpu : null);

  if (!("gpu" in navigator)) {
    showFallback("navigator.gpu 不存在：通常是未开启 WebGPU 实验特性，或不是安全上下文（需 https:// 或 http://localhost）。");
    return;
  }

  let adapter;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (e) {
    showFallback(`requestAdapter() 抛错：${e?.message || e}`);
    return;
  }
  if (!adapter) {
    showFallback("requestAdapter() 返回 null：通常是 WebGPU 未开启/被策略禁用/不在安全上下文/或系统不支持该实现。");
    return;
  }
  log("adapter =", adapter);
  // These are often useful when debugging Safari/WebKit behavior.
  try {
    log("adapter.features =", [...adapter.features.values()]);
  } catch {
    // ignore
  }

  let device;
  try {
    device = await adapter.requestDevice();
  } catch (e) {
    showFallback(`requestDevice() 抛错：${e?.message || e}`);
    return;
  }
  device.lost.then((info) => {
    console.error("[webgpu] device lost:", info);
  });
  const queue = device.queue;

  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("c"));
  const ctx = /** @type {GPUCanvasContext} */ (canvas.getContext("webgpu"));
  const glassUi = /** @type {HTMLDivElement | null} */ (document.getElementById("glass-ui"));
  if (!ctx) {
    showFallback("canvas.getContext('webgpu') 返回 null：可能是 WebGPU 未启用，或页面不是安全上下文。");
    return;
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat
    ? navigator.gpu.getPreferredCanvasFormat()
    : /** @type {GPUTextureFormat} */ ("bgra8unorm");
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

  const module = device.createShaderModule({ code: wgsl });
  if (typeof module.getCompilationInfo === "function") {
    try {
      const info = await module.getCompilationInfo();
      if (info.messages?.length) {
        let hasError = false;
        console.groupCollapsed?.("[webgpu] shader compilation info");
        for (const m of info.messages) {
          const where = `line ${m.lineNum}:${m.linePos}`;
          const msg = `${m.type.toUpperCase()} ${where} ${m.message}`;
          if (m.type === "error") {
            hasError = true;
            console.error(msg);
          } else if (m.type === "warning") {
            console.warn(msg);
          } else {
            console.log(msg);
          }
        }
        console.groupEnd?.();
        if (hasError) {
          showFallback("WGSL 编译失败：请查看控制台中的 shader compilation info。");
          return;
        }
      } else {
        log("shader compilation info: (no messages)");
      }
    } catch (e) {
      console.warn("[webgpu] getCompilationInfo() failed:", e?.message || e);
    }
  }

  // Surface any validation errors (Safari sometimes does not show these clearly otherwise).
  device.pushErrorScope("validation");
  device.pushErrorScope("out-of-memory");

  const state = createGlassState({ minW: MIN_W, minH: MIN_H });
  const updateGlassUi = (visible) => {
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
    module,
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
    const oom = await device.popErrorScope();
    const val = await device.popErrorScope();
    if (oom) console.error("[webgpu] OOM error:", oom);
    if (val) console.error("[webgpu] Validation error:", val);
    if (oom || val) {
      const msg = String((val || oom)?.message || val || oom);
      showFallback(`GPU 校验失败：${msg}`);
      return;
    }
  }

  // Render on demand (prevents log/error spam if something goes wrong).
  let rafPending = false;
  const stoppedRef = { value: false };
  const requestRender = () => {
    if (stoppedRef.value || rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      try {
        renderer.ensureCanvasConfigured();
        renderer.writeUniforms();
        renderer.render();
      } catch (e) {
        stoppedRef.value = true;
        console.error("[webgpu] render failed:", e?.message || e);
        showFallback(`渲染失败：${e?.message || e}`);
      }
    });
  };

  // If Safari fires a GPU error, stop further renders to avoid spamming the console.
  device.onuncapturederror = (ev) => {
    stoppedRef.value = true;
    console.error("[webgpu] uncapturederror:", ev.error?.message || ev.error);
    showFallback(`GPU 错误：${ev.error?.message || ev.error}`);
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

main().catch((err) => {
  console.error(err);
  showFallback(`main() 未捕获异常：${err?.message || err}`);
});
