import type { StoppedRef } from "../types/common";
import type { Renderer } from "../types/renderer";
import { showFallback } from "../utils/dom";

/**
 * 统一异常文本，避免 `unknown` 直接输出。
 * @param err 未知异常。
 * @returns 可读错误文本。
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 运行时创建依赖。 */
interface CreateRuntimeOptions {
  /** GPU 设备。 */
  device: GPUDevice;
  /** 渲染器实例。 */
  renderer: Renderer;
}

/** 运行时控制对象。 */
export interface Runtime {
  /** 请求一次渲染。 */
  requestRender(): void;
  /** 停止标记引用。 */
  stoppedRef: StoppedRef;
  /** 注册清理函数。 */
  addCleanup(cleanup: () => void): void;
  /** 主动清理并停止。 */
  dispose(): void;
}

/**
 * 构建运行时调度器：管理渲染请求、窗口监听与资源清理。
 * @param options 运行时依赖。
 * @returns 统一运行时对象。
 */
export function createRuntime({
  device,
  renderer,
}: CreateRuntimeOptions): Runtime {
  // 标记是否已有待执行帧。
  let rafPending = false;
  // 共享停止标记。
  const stoppedRef: StoppedRef = { value: false };

  // 清理函数列表。
  const cleanups: Array<() => void> = [];

  const requestRender = (): void => {
    // 已停止或已有待执行帧时，直接忽略重复请求。
    if (stoppedRef.value || rafPending) return;

    // 进入排队状态，等待下一帧。
    rafPending = true;
    requestAnimationFrame(() => {
      // 清除排队标记。
      rafPending = false;
      try {
        // 每帧前先确保画布尺寸与配置有效。
        renderer.ensureCanvasConfigured();
        // 再写入最新 uniform，确保渲染使用最新状态。
        renderer.writeUniforms();
        // 执行渲染。
        renderer.render();
      } catch (err) {
        // 异常时停止后续渲染。
        stoppedRef.value = true;
        console.error("[webgpu] render failed:", errorMessage(err));
        showFallback(`渲染失败：${errorMessage(err)}`);
      }
    });
  };

  const onResize = (): void => {
    // 窗口尺寸变化时刷新渲染。
    requestRender();
  };

  const onUncapturedError = (event: GPUUncapturedErrorEvent): void => {
    // 发生未捕获 GPU 错误时停止渲染。
    stoppedRef.value = true;
    // 读取错误信息，保证兼容未知实现。
    const uncapturedErrorMessage = event.error?.message ?? String(event.error);
    console.error("[webgpu] uncapturederror:", uncapturedErrorMessage);
    showFallback(`GPU 错误：${uncapturedErrorMessage}`);
  };

  // 监听窗口尺寸变化。
  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    // 清理 resize 监听。
    window.removeEventListener("resize", onResize);
  });

  // 绑定未捕获 GPU 错误处理。
  device.onuncapturederror = onUncapturedError;
  cleanups.push(() => {
    // 清理 GPU 错误处理。
    device.onuncapturederror = null;
  });

  const dispose = (): void => {
    // 标记停止。
    stoppedRef.value = true;
    // 按注册顺序执行清理。
    for (const cleanup of cleanups.splice(0)) {
      try {
        cleanup();
      } catch {
        // 清理阶段异常不应阻塞后续清理。
      }
    }
  };

  const addCleanup = (cleanup: () => void): void => {
    // 追加清理函数。
    cleanups.push(cleanup);
  };

  return {
    requestRender,
    stoppedRef,
    addCleanup,
    dispose,
  };
}
