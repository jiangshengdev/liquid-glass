/** 纹理格式字符串。 */
type GPUTextureFormat = string;

/** 错误过滤类型。 */
type GPUErrorFilter = "validation" | "out-of-memory" | "internal";

/** GPU 缓冲区用途标记。 */
declare const GPUBufferUsage: {
  readonly UNIFORM: number;
  readonly COPY_DST: number;
};

/** Shader 阶段标记。 */
declare const GPUShaderStage: {
  readonly VERTEX: number;
  readonly FRAGMENT: number;
};

/** 纹理用途标记。 */
declare const GPUTextureUsage: {
  readonly TEXTURE_BINDING: number;
  readonly COPY_DST: number;
  readonly RENDER_ATTACHMENT: number;
};

/** 浏览器 GPU 接口。 */
interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

/** GPU 适配器。 */
interface GPUAdapter {
  readonly features: ReadonlySet<string>;
  requestDevice(): Promise<GPUDevice>;
}

/** 设备丢失信息。 */
interface GPUDeviceLostInfo {
  readonly message: string;
}

/** 错误信息类型。 */
interface GPUErrorLike {
  readonly message?: string;
}

/** 未捕获 GPU 错误事件。 */
interface GPUUncapturedErrorEvent extends Event {
  readonly error: GPUErrorLike;
}

/** 采样器品牌类型。 */
type GPUSampler = { readonly __brand: "GPUSampler" };
/** 纹理视图品牌类型。 */
type GPUTextureView = { readonly __brand: "GPUTextureView" };
/** 缓冲区品牌类型。 */
type GPUBuffer = { readonly __brand: "GPUBuffer" };
/** BindGroupLayout 品牌类型。 */
type GPUBindGroupLayout = { readonly __brand: "GPUBindGroupLayout" };
/** BindGroup 品牌类型。 */
type GPUBindGroup = { readonly __brand: "GPUBindGroup" };
/** PipelineLayout 品牌类型。 */
type GPUPipelineLayout = { readonly __brand: "GPUPipelineLayout" };
/** RenderPipeline 品牌类型。 */
type GPURenderPipeline = { readonly __brand: "GPURenderPipeline" };
/** 命令缓冲区品牌类型。 */
type GPUCommandBuffer = { readonly __brand: "GPUCommandBuffer" };

/** GPU 纹理对象。 */
interface GPUTexture {
  createView(): GPUTextureView;
  destroy(): void;
}

/** Shader 模块对象。 */
interface GPUShaderModule {
  getCompilationInfo(): Promise<GPUCompilationInfo>;
}

/** Shader 编译信息。 */
interface GPUCompilationInfo {
  readonly messages: GPUCompilationMessage[];
}

/** Shader 编译消息。 */
interface GPUCompilationMessage {
  readonly type: "error" | "warning" | "info";
  readonly message: string;
  readonly lineNum: number;
  readonly linePos: number;
}

/** 命令编码器。 */
interface GPUCommandEncoder {
  beginRenderPass(descriptor: Record<string, unknown>): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

/** 渲染通道编码器。 */
interface GPURenderPassEncoder {
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  setPipeline(pipeline: GPURenderPipeline): void;
  draw(vertexCount: number): void;
  end(): void;
}

/** GPU 提交队列。 */
interface GPUQueue {
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
  ): void;
  copyExternalImageToTexture(
    source: { source: ImageBitmap },
    destination: { texture: GPUTexture },
    copySize: { width: number; height: number },
  ): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

/** 画布 WebGPU 上下文。 */
interface GPUCanvasContext {
  configure(configuration: Record<string, unknown>): void;
  getCurrentTexture(): GPUTexture;
}

/** GPU 设备对象。 */
interface GPUDevice {
  readonly queue: GPUQueue;
  readonly lost: Promise<GPUDeviceLostInfo>;
  onuncapturederror: ((event: GPUUncapturedErrorEvent) => void) | null;
  createSampler(descriptor: Record<string, unknown>): GPUSampler;
  createTexture(descriptor: Record<string, unknown>): GPUTexture;
  createShaderModule(descriptor: { code: string }): GPUShaderModule;
  createBuffer(descriptor: Record<string, unknown>): GPUBuffer;
  createBindGroupLayout(
    descriptor: Record<string, unknown>,
  ): GPUBindGroupLayout;
  createBindGroup(descriptor: Record<string, unknown>): GPUBindGroup;
  createPipelineLayout(descriptor: Record<string, unknown>): GPUPipelineLayout;
  createRenderPipeline(descriptor: Record<string, unknown>): GPURenderPipeline;
  createCommandEncoder(): GPUCommandEncoder;
  pushErrorScope(filter: GPUErrorFilter): void;
  popErrorScope(): Promise<GPUErrorLike | null>;
}

/** 浏览器导航对象扩展。 */
interface Navigator {
  gpu?: GPU;
}

/** 画布元素扩展。 */
interface HTMLCanvasElement {
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}
