import { describe, expect, it } from "vitest";

import { hasHtmlInCanvasWebGpuSupport } from "../src/utils/html-in-canvas";

function canvasWithCapabilities(capabilities: {
  onpaint?: boolean;
  getElementTransform?: boolean;
}): HTMLCanvasElement {
  const canvas = {} as HTMLCanvasElement;

  if (capabilities.onpaint) {
    Object.defineProperty(canvas, "onpaint", {
      configurable: true,
      value: null,
      writable: true,
    });
  }

  if (capabilities.getElementTransform) {
    Object.defineProperty(canvas, "getElementTransform", {
      configurable: true,
      value: () => new DOMMatrix(),
    });
  }

  return canvas;
}

function queueWithCapabilities(capabilities: {
  copyElementImageToTexture?: boolean;
}): GPUQueue {
  const queue = {} as GPUQueue;

  if (capabilities.copyElementImageToTexture) {
    Object.defineProperty(queue, "copyElementImageToTexture", {
      configurable: true,
      value: () => undefined,
    });
  }

  return queue;
}

describe("utils/html-in-canvas", () => {
  it("returns true when canvas and GPU queue expose required APIs", () => {
    const supported = hasHtmlInCanvasWebGpuSupport({
      canvas: canvasWithCapabilities({
        onpaint: true,
        getElementTransform: true,
      }),
      queue: queueWithCapabilities({ copyElementImageToTexture: true }),
    });

    expect(supported).toBe(true);
  });

  it("returns false when copyElementImageToTexture is missing", () => {
    const supported = hasHtmlInCanvasWebGpuSupport({
      canvas: canvasWithCapabilities({
        onpaint: true,
        getElementTransform: true,
      }),
      queue: queueWithCapabilities({}),
    });

    expect(supported).toBe(false);
  });

  it("returns false when canvas paint callback support is missing", () => {
    const supported = hasHtmlInCanvasWebGpuSupport({
      canvas: canvasWithCapabilities({ getElementTransform: true }),
      queue: queueWithCapabilities({ copyElementImageToTexture: true }),
    });

    expect(supported).toBe(false);
  });

  it("returns false when getElementTransform is missing", () => {
    const supported = hasHtmlInCanvasWebGpuSupport({
      canvas: canvasWithCapabilities({ onpaint: true }),
      queue: queueWithCapabilities({ copyElementImageToTexture: true }),
    });

    expect(supported).toBe(false);
  });
});
