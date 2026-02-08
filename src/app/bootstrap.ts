import wgsl from "../shaders.wgsl?raw";
import { showFallback } from "../utils/dom";
import { createImageTexture, loadBitmap } from "../utils/image";

/**
 * 将未知异常转换为可读文本。
 * @param err 未知异常对象。
 * @returns 标准化错误信息。
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 启动阶段成功产物：渲染器创建所需的全部 WebGPU 与页面资源。
 */
export interface BootstrapResult {
  log: (...args: unknown[]) => void;
  device: GPUDevice;
  queue: GPUQueue;
  canvas: HTMLCanvasElement;
  canvasContext: GPUCanvasContext;
  glassUi: HTMLDivElement | null;
  presentationFormat: GPUTextureFormat;
  sampler: GPUSampler;
  imageTexture: GPUTexture;
  imageAspect: number;
  shaderModule: GPUShaderModule;
}

/**
 * 执行 WebGPU 启动流程：能力检测、设备申请、画布绑定、纹理加载与 Shader 编译。
 * @returns 成功返回启动结果，失败返回 `null` 并展示回退提示。
 */
export async function bootstrapWebGpuApp(): Promise<BootstrapResult | null> {
  // 统一带前缀日志，便于区分浏览器与应用输出。
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
    // 忽略特性枚举异常，避免影响主流程。
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

  const canvasEl = document.getElementById("webgpu-canvas");
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    showFallback(
      "未找到 #webgpu-canvas 画布元素。请确认 index.html 页面结构是否完整。",
    );
    return null;
  }
  const canvas = canvasEl;

  const canvasContext = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!canvasContext) {
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

  const imageUrl = new URL("../assets/left-image.png", import.meta.url).href;
  log("loading image =", imageUrl);

  const bitmap = await loadBitmap(imageUrl);
  log("image bitmap =", { width: bitmap.width, height: bitmap.height });

  const imageAspect = bitmap.width / Math.max(1, bitmap.height);
  const imageTexture = createImageTexture(device, queue, bitmap);

  const shaderModule = device.createShaderModule({ code: wgsl });
  if (typeof shaderModule.getCompilationInfo === "function") {
    try {
      const info = await shaderModule.getCompilationInfo();
      if (info.messages.length > 0) {
        let hasError = false;

        // 分组打印编译消息，便于快速定位行号与类型。
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
          return null;
        }
      } else {
        log("shader compilation info: (no messages)");
      }
    } catch (err) {
      // 某些实现可能不支持完整编译信息接口，这里仅告警。
      console.warn("[webgpu] getCompilationInfo() failed:", errorMessage(err));
    }
  }

  return {
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
  };
}
