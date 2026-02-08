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

interface CreateRuntimeOptions {
  device: GPUDevice;
  renderer: Renderer;
}

export interface Runtime {
  requestRender(): void;
  stoppedRef: StoppedRef;
  addCleanup(cleanup: () => void): void;
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
  let rafPending = false;
  const stoppedRef: StoppedRef = { value: false };

  const cleanups: Array<() => void> = [];

  const requestRender = (): void => {
    // 已停止或已有待执行帧时，直接忽略重复请求。
    if (stoppedRef.value || rafPending) return;

    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      try {
        // 每帧前先确保画布尺寸与配置有效。
        renderer.ensureCanvasConfigured();
        // 再写入最新 uniform，确保渲染使用最新状态。
        renderer.writeUniforms();
        renderer.render();
      } catch (err) {
        stoppedRef.value = true;
        console.error("[webgpu] render failed:", errorMessage(err));
        showFallback(`渲染失败：${errorMessage(err)}`);
      }
    });
  };

  const onResize = (): void => {
    requestRender();
  };

  const onUncapturedError = (event: GPUUncapturedErrorEvent): void => {
    stoppedRef.value = true;
    const uncapturedErrorMessage = event.error?.message ?? String(event.error);
    console.error("[webgpu] uncapturederror:", uncapturedErrorMessage);
    showFallback(`GPU 错误：${uncapturedErrorMessage}`);
  };

  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    window.removeEventListener("resize", onResize);
  });

  device.onuncapturederror = onUncapturedError;
  cleanups.push(() => {
    device.onuncapturederror = null;
  });

  const dispose = (): void => {
    stoppedRef.value = true;
    for (const cleanup of cleanups.splice(0)) {
      try {
        cleanup();
      } catch {
        // 清理阶段异常不应阻塞后续清理。
      }
    }
  };

  const addCleanup = (cleanup: () => void): void => {
    cleanups.push(cleanup);
  };

  return {
    requestRender,
    stoppedRef,
    addCleanup,
    dispose,
  };
}
