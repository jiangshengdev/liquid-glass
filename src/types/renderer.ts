import type { GlassParams, LogFn } from "./common";
import type { GlassState } from "./state";

export interface Renderer {
  ensureCanvasConfigured(): boolean;
  writeUniforms(): void;
  render(): void;
  setSceneDirty(value: boolean): void;
}

export interface RendererDeps {
  device: GPUDevice;
  queue: GPUQueue;
  canvas: HTMLCanvasElement;
  canvasContext: GPUCanvasContext;
  sampler: GPUSampler;
  imageTex: GPUTexture;
  module: GPUShaderModule;
  presentationFormat: GPUTextureFormat;
  imageAspect: number;
  state: GlassState;
  params: GlassParams;
  devicePixelRatioClamped: () => number;
  log: LogFn;
  updateGlassUi: (visible?: boolean) => void;
  isGlassUiHidden: () => boolean;
}
