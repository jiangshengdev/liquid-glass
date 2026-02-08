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
  /** 统一日志输出函数。 */
  log: (...args: unknown[]) => void;
  /** GPU 设备实例。 */
  device: GPUDevice;
  /** GPU 队列实例。 */
  queue: GPUQueue;
  /** 绑定的画布元素。 */
  canvas: HTMLCanvasElement;
  /** 画布 WebGPU 上下文。 */
  canvasContext: GPUCanvasContext;
  /** 玻璃 UI 元素（可能为空）。 */
  glassUi: HTMLDivElement | null;
  /** 画布首选交换链格式。 */
  presentationFormat: GPUTextureFormat;
  /** 纹理采样器。 */
  sampler: GPUSampler;
  /** 背景图纹理。 */
  imageTexture: GPUTexture;
  /** 背景图宽高比。 */
  imageAspect: number;
  /** 编译后的 Shader 模块。 */
  shaderModule: GPUShaderModule;
}

/**
 * 执行 WebGPU 启动流程：能力检测、设备申请、画布绑定、纹理加载与 Shader 编译。
 * @returns 成功返回启动结果，失败返回 `null` 并展示回退提示。
 */
export async function bootstrapWebGpuApp(): Promise<BootstrapResult | null> {
  // 统一带前缀日志，便于区分浏览器与应用输出。
  const log = (...args: unknown[]) => console.log("[webgpu]", ...args);
  // 输出当前页面信息，便于排查环境问题。
  log("href =", location.href);
  log("isSecureContext =", window.isSecureContext);
  log("userAgent =", navigator.userAgent);

  // 获取浏览器的 WebGPU 接口。
  const gpu = navigator.gpu;
  log("navigator.gpu =", gpu ?? null);

  if (!gpu) {
    // WebGPU 不可用时直接走回退提示。
    showFallback(
      "navigator.gpu 不存在：通常是未开启 WebGPU 实验特性，或不是安全上下文（需 https:// 或 http://localhost）。",
    );
    return null;
  }

  let adapter: GPUAdapter | null;
  try {
    // 请求 GPU 适配器。
    adapter = await gpu.requestAdapter();
  } catch (err) {
    // 适配器申请失败时提示原因。
    showFallback(`requestAdapter() 抛错：${errorMessage(err)}`);
    return null;
  }

  if (!adapter) {
    // 适配器为空时给出常见原因。
    showFallback(
      "requestAdapter() 返回 null：通常是 WebGPU 未开启/被策略禁用/不在安全上下文/或系统不支持该实现。",
    );
    return null;
  }

  log("adapter =", adapter);
  try {
    // 输出适配器特性列表，便于调试差异。
    log("adapter.features =", [...adapter.features.values()]);
  } catch {
    // 忽略特性枚举异常，避免影响主流程。
  }

  let device: GPUDevice;
  try {
    // 请求 GPU 设备。
    device = await adapter.requestDevice();
  } catch (err) {
    // 设备申请失败时提示原因。
    showFallback(`requestDevice() 抛错：${errorMessage(err)}`);
    return null;
  }

  // 监听设备丢失并记录信息。
  device.lost.then((info) => {
    console.error("[webgpu] device lost:", info);
  });

  // 设备队列用于提交命令。
  const queue = device.queue;

  // 获取画布元素。
  const canvasEl = document.getElementById("webgpu-canvas");
  if (!(canvasEl instanceof HTMLCanvasElement)) {
    // 画布不存在时提示页面结构问题。
    showFallback(
      "未找到 #webgpu-canvas 画布元素。请确认 index.html 页面结构是否完整。",
    );
    return null;
  }
  // 归一化变量命名。
  const canvas = canvasEl;

  // 获取 WebGPU 画布上下文。
  const canvasContext = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!canvasContext) {
    // 上下文创建失败时直接回退。
    showFallback(
      "canvas.getContext(webgpu) 返回 null：可能是 WebGPU 未启用，或页面不是安全上下文。",
    );
    return null;
  }

  // 获取用于辅助显示的玻璃 UI。
  const glassUiNode = document.getElementById("glass-ui");
  const glassUi = glassUiNode instanceof HTMLDivElement ? glassUiNode : null;

  // 选择优先格式，兼容旧实现。
  const presentationFormat = gpu.getPreferredCanvasFormat
    ? gpu.getPreferredCanvasFormat()
    : ("bgra8unorm" as GPUTextureFormat);
  log("presentationFormat =", presentationFormat);

  // 创建线性采样器。
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  // 解析图片资源地址。
  const imageUrl = new URL("../assets/left-image.png", import.meta.url).href;
  log("loading image =", imageUrl);

  // 加载位图并输出尺寸。
  const bitmap = await loadBitmap(imageUrl);
  log("image bitmap =", { width: bitmap.width, height: bitmap.height });

  // 计算图片宽高比。
  const imageAspect = bitmap.width / Math.max(1, bitmap.height);
  // 创建纹理并上传像素数据。
  const imageTexture = createImageTexture(device, queue, bitmap);

  // 创建 WGSL Shader 模块。
  const shaderModule = device.createShaderModule({ code: wgsl });
  if (typeof shaderModule.getCompilationInfo === "function") {
    try {
      // 读取编译信息并输出。
      const info = await shaderModule.getCompilationInfo();
      if (info.messages.length > 0) {
        // 记录是否存在错误信息。
        let hasError = false;

        // 分组打印编译消息，便于快速定位行号与类型。
        console.groupCollapsed?.("[webgpu] shader compilation info");
        for (const message of info.messages) {
          // 拼接格式化的日志文本。
          const where = `line ${message.lineNum}:${message.linePos}`;
          const text = `${message.type.toUpperCase()} ${where} ${message.message}`;
          if (message.type === "error") {
            // 错误需要标记并输出。
            hasError = true;
            console.error(text);
          } else if (message.type === "warning") {
            // 警告按 warn 输出。
            console.warn(text);
          } else {
            // 其它信息按普通日志输出。
            console.log(text);
          }
        }
        console.groupEnd?.();

        if (hasError) {
          // 编译失败时直接回退。
          showFallback(
            "WGSL 编译失败：请查看控制台中的 shader compilation info。",
          );
          return null;
        }
      } else {
        // 无消息时仍记录一次。
        log("shader compilation info: (no messages)");
      }
    } catch (err) {
      // 某些实现可能不支持完整编译信息接口，这里仅告警。
      console.warn("[webgpu] getCompilationInfo() failed:", errorMessage(err));
    }
  }

  // 返回启动阶段所需的全部资源。
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
