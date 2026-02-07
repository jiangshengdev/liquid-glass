type GPUTextureFormat = string;

type GPUErrorFilter = "validation" | "out-of-memory" | "internal";

declare const GPUBufferUsage: {
  readonly UNIFORM: number;
  readonly COPY_DST: number;
};

declare const GPUShaderStage: {
  readonly VERTEX: number;
  readonly FRAGMENT: number;
};

declare const GPUTextureUsage: {
  readonly TEXTURE_BINDING: number;
  readonly COPY_DST: number;
  readonly RENDER_ATTACHMENT: number;
};

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface GPUAdapter {
  readonly features: ReadonlySet<string>;
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDeviceLostInfo {
  readonly message: string;
}

interface GPUErrorLike {
  readonly message?: string;
}

interface GPUUncapturedErrorEvent extends Event {
  readonly error: GPUErrorLike;
}

type GPUSampler = { readonly __brand: "GPUSampler" };
type GPUTextureView = { readonly __brand: "GPUTextureView" };
type GPUBuffer = { readonly __brand: "GPUBuffer" };
type GPUBindGroupLayout = { readonly __brand: "GPUBindGroupLayout" };
type GPUBindGroup = { readonly __brand: "GPUBindGroup" };
type GPUPipelineLayout = { readonly __brand: "GPUPipelineLayout" };
type GPURenderPipeline = { readonly __brand: "GPURenderPipeline" };
type GPUCommandBuffer = { readonly __brand: "GPUCommandBuffer" };

interface GPUTexture {
  createView(): GPUTextureView;
  destroy(): void;
}

interface GPUShaderModule {
  getCompilationInfo(): Promise<GPUCompilationInfo>;
}

interface GPUCompilationInfo {
  readonly messages: GPUCompilationMessage[];
}

interface GPUCompilationMessage {
  readonly type: "error" | "warning" | "info";
  readonly message: string;
  readonly lineNum: number;
  readonly linePos: number;
}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: Record<string, unknown>): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPURenderPassEncoder {
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  setPipeline(pipeline: GPURenderPipeline): void;
  draw(vertexCount: number): void;
  end(): void;
}

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

interface GPUCanvasContext {
  configure(configuration: Record<string, unknown>): void;
  getCurrentTexture(): GPUTexture;
}

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

interface Navigator {
  gpu?: GPU;
}

interface HTMLCanvasElement {
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}
