import { describe, expect, it } from "vitest";

import {
  hasHtmlInCanvasWebGpuSupport,
  syncHtmlInCanvasElementTransform,
} from "../src/utils/html-in-canvas";

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

  it("syncs the CSS transform returned by getElementTransform", () => {
    const returnedTransform = {
      toString: () => "matrix(1, 0, 0, 1, 24, 32)",
    } as DOMMatrix;
    const drawTransform = {} as DOMMatrix;
    const element = { style: { transform: "" } } as HTMLElement;
    let receivedElement: Element | null = null;
    let receivedTransform: DOMMatrix | null = null;
    const canvas = {
      getElementTransform: (nextElement: Element, nextTransform: DOMMatrix) => {
        receivedElement = nextElement;
        receivedTransform = nextTransform;
        return returnedTransform;
      },
    } as HTMLCanvasElement;

    const synced = syncHtmlInCanvasElementTransform({
      canvas,
      element,
      drawTransform,
    });

    expect(synced).toBe(true);
    expect(receivedElement).toBe(element);
    expect(receivedTransform).toBe(drawTransform);
    expect(element.style.transform).toBe("matrix(1, 0, 0, 1, 24, 32)");
  });

  it("does not update CSS transform when getElementTransform returns null", () => {
    const element = { style: { transform: "initial" } } as HTMLElement;
    const canvas = {
      getElementTransform: () => null,
    } as HTMLCanvasElement;

    const synced = syncHtmlInCanvasElementTransform({
      canvas,
      element,
      drawTransform: {} as DOMMatrix,
    });

    expect(synced).toBe(false);
    expect(element.style.transform).toBe("initial");
  });
});
