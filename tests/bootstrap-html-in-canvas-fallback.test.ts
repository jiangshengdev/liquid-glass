import { describe, expect, it, vi } from "vitest";

const showFallbackMock = vi.fn();

vi.mock("../src/utils/dom", () => ({
  showFallback: showFallbackMock,
}));

vi.mock("../src/utils/image", () => ({
  loadBitmap: vi.fn(async () => ({ width: 120, height: 80 })),
  createImageTexture: vi.fn(() => ({})),
}));

class FakeCanvasElement {
  getContext(type: string): GPUCanvasContext | null {
    return type === "webgpu" ? ({} as GPUCanvasContext) : null;
  }
}

class FakeSpanElement {
  hidden = false;
}

class FakeDivElement {}

class FakeInputElement {}

function installDomGlobals(elements: Record<string, unknown>): void {
  Object.defineProperty(globalThis, "HTMLCanvasElement", {
    configurable: true,
    value: FakeCanvasElement,
  });
  Object.defineProperty(globalThis, "HTMLSpanElement", {
    configurable: true,
    value: FakeSpanElement,
  });
  Object.defineProperty(globalThis, "HTMLDivElement", {
    configurable: true,
    value: FakeDivElement,
  });
  Object.defineProperty(globalThis, "HTMLInputElement", {
    configurable: true,
    value: FakeInputElement,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      getElementById: (id: string) => elements[id] ?? null,
    },
  });
}

function installBrowserGlobals(): void {
  const queue = {};
  const device = {
    queue,
    lost: new Promise(() => undefined),
    createSampler: vi.fn(() => ({})),
    createShaderModule: vi.fn(() => ({
      getCompilationInfo: vi.fn(async () => ({ messages: [] })),
    })),
  };
  const adapter = {
    features: new Set(),
    requestDevice: vi.fn(async () => device),
  };
  const gpu = {
    requestAdapter: vi.fn(async () => adapter),
    getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { gpu },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: true,
    },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { href: "http://localhost/" },
  });
}

describe("app/bootstrap HTML-in-Canvas fallback", () => {
  it("continues startup and hides label when HTML-in-Canvas is unsupported", async () => {
    const canvas = new FakeCanvasElement();
    const label = new FakeSpanElement();
    const backgroundLayer = new FakeDivElement() as FakeDivElement & {
      hidden: boolean;
    };
    backgroundLayer.hidden = false;
    installDomGlobals({
      "webgpu-canvas": canvas,
      "glass-ui": new FakeDivElement(),
      "glass-button-label": label,
      "background-html-layer": backgroundLayer,
      "debug-refraction-arrows": null,
    });
    installBrowserGlobals();

    const { bootstrapWebGpuApp } = await import("../src/app/bootstrap");

    const result = await bootstrapWebGpuApp();

    expect(result).not.toBeNull();
    expect(showFallbackMock).not.toHaveBeenCalled();
    expect(label.hidden).toBe(true);
    expect(backgroundLayer.hidden).toBe(true);
  });
});
