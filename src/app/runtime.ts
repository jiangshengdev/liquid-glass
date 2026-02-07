import type { StoppedRef } from "../types/common";
import type { Renderer } from "../types/renderer";
import { showFallback } from "../utils/dom";

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

export function createRuntime({
  device,
  renderer,
}: CreateRuntimeOptions): Runtime {
  let rafPending = false;
  const stoppedRef: StoppedRef = { value: false };

  const cleanups: Array<() => void> = [];

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

  const onResize = (): void => {
    requestRender();
  };

  const onUncapturedError = (event: GPUUncapturedErrorEvent): void => {
    stoppedRef.value = true;
    const uncapturedErrorMessage =
      event.error?.message ?? String(event.error);
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
        // ignore
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
