import wgsl from "../shaders.wgsl?raw";
import { showFallback } from "../utils/dom";
import { createImageTexture, loadBitmap } from "../utils/image";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface BootstrapResult {
  log: (...args: unknown[]) => void;
  device: GPUDevice;
  queue: GPUQueue;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  glassUi: HTMLDivElement | null;
  presentationFormat: GPUTextureFormat;
  sampler: GPUSampler;
  imageTex: GPUTexture;
  imageAspect: number;
  shaderModule: GPUShaderModule;
}

export async function bootstrapWebGpuApp(): Promise<BootstrapResult | null> {
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
    return null;
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter();
  } catch (err) {
    showFallback(`requestAdapter() 抛错：${errorMessage(err)}`);
    return null;
  }

  if (!adapter) {
    showFallback(
      "requestAdapter() 返回 null：通常是 WebGPU 未开启/被策略禁用/不在安全上下文/或系统不支持该实现。",
    );
    return null;
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
    return null;
  }

  device.lost.then((info) => {
    console.error("[webgpu] device lost:", info);
  });

  const queue = device.queue;

  const canvasEl = document.getElementById("c");
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    showFallback("未找到 #c 画布元素。请确认 index.html 页面结构是否完整。");
    return null;
  }
  const canvas = canvasEl;

  const ctx = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!ctx) {
    showFallback(
      "canvas.getContext(webgpu) 返回 null：可能是 WebGPU 未启用，或页面不是安全上下文。",
    );
    return null;
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

  const imgUrl = new URL("../assets/left-image.png", import.meta.url).href;
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
          showFallback("WGSL 编译失败：请查看控制台中的 shader compilation info。");
          return null;
        }
      } else {
        log("shader compilation info: (no messages)");
      }
    } catch (err) {
      console.warn("[webgpu] getCompilationInfo() failed:", errorMessage(err));
    }
  }

  return {
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
  };
}
