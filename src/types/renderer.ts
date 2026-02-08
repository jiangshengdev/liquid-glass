import type { GlassParams, LogFn } from "./common";
import type { GlassState } from "./state";

/** 渲染器对外能力集合。 */
export interface Renderer {
  /** 同步画布尺寸并返回是否发生变化。 */
  ensureCanvasConfigured(): boolean;
  /** 写入当前 uniform 数据。 */
  writeUniforms(): void;
  /** 执行一帧渲染。 */
  render(): void;
  /** 标记场景是否需要重建离屏结果。 */
  setSceneDirty(value: boolean): void;
}

/** 创建渲染器所需依赖集合。 */
export interface RendererDeps {
  /** GPU 设备。 */
  device: GPUDevice;
  /** GPU 队列。 */
  queue: GPUQueue;
  /** 渲染画布。 */
  canvas: HTMLCanvasElement;
  /** 画布 WebGPU 上下文。 */
  canvasContext: GPUCanvasContext;
  /** 纹理采样器。 */
  sampler: GPUSampler;
  /** 背景图纹理。 */
  imageTexture: GPUTexture;
  /** Shader 模块。 */
  module: GPUShaderModule;
  /** 交换链格式。 */
  presentationFormat: GPUTextureFormat;
  /** 背景图宽高比。 */
  imageAspect: number;
  /** 玻璃状态。 */
  state: GlassState;
  /** 玻璃参数。 */
  params: GlassParams;
  /** 设备像素比夹取函数。 */
  devicePixelRatioClamped: () => number;
  /** 日志函数。 */
  log: LogFn;
  /** 更新玻璃 UI 显示状态。 */
  updateGlassUi: (visible?: boolean) => void;
  /** 判断玻璃 UI 是否隐藏。 */
  isGlassUiHidden: () => boolean;
}
