/** 纹理格式字符串。 */
type GPUTextureFormat = string;

/** 错误过滤类型。 */
type GPUErrorFilter = "validation" | "out-of-memory" | "internal";

/** GPU 缓冲区用途标记。 */
declare const GPUBufferUsage: {
  /** uniform 缓冲用途。 */
  readonly UNIFORM: number;
  /** 复制目标用途。 */
  readonly COPY_DST: number;
};

/** Shader 阶段标记。 */
declare const GPUShaderStage: {
  /** 顶点阶段。 */
  readonly VERTEX: number;
  /** 片元阶段。 */
  readonly FRAGMENT: number;
};

/** 纹理用途标记。 */
declare const GPUTextureUsage: {
  /** 作为纹理绑定。 */
  readonly TEXTURE_BINDING: number;
  /** 作为复制目标。 */
  readonly COPY_DST: number;
  /** 作为渲染附件。 */
  readonly RENDER_ATTACHMENT: number;
};

/** 浏览器 GPU 接口。 */
interface GPU {
  /** 请求 GPU 适配器。 */
  requestAdapter(): Promise<GPUAdapter | null>;
  /** 获取首选画布格式。 */
  getPreferredCanvasFormat(): GPUTextureFormat;
}

/** GPU 适配器。 */
interface GPUAdapter {
  /** 支持的特性集合。 */
  readonly features: ReadonlySet<string>;
  /** 请求 GPU 设备。 */
  requestDevice(): Promise<GPUDevice>;
}

/** 设备丢失信息。 */
interface GPUDeviceLostInfo {
  /** 丢失原因信息。 */
  readonly message: string;
}

/** 错误信息类型。 */
interface GPUErrorLike {
  /** 错误描述文本。 */
  readonly message?: string;
}

/** 未捕获 GPU 错误事件。 */
interface GPUUncapturedErrorEvent extends Event {
  /** 错误对象。 */
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
  /** 创建纹理视图。 */
  createView(): GPUTextureView;
  /** 销毁纹理。 */
  destroy(): void;
}

/** Shader 模块对象。 */
interface GPUShaderModule {
  /** 获取编译信息。 */
  getCompilationInfo(): Promise<GPUCompilationInfo>;
}

/** Shader 编译信息。 */
interface GPUCompilationInfo {
  /** 编译消息列表。 */
  readonly messages: GPUCompilationMessage[];
}

/** Shader 编译消息。 */
interface GPUCompilationMessage {
  /** 消息类型。 */
  readonly type: "error" | "warning" | "info";
  /** 消息内容。 */
  readonly message: string;
  /** 行号。 */
  readonly lineNum: number;
  /** 行内位置。 */
  readonly linePos: number;
}

/** 命令编码器。 */
interface GPUCommandEncoder {
  /** 开始一个渲染通道。 */
  beginRenderPass(descriptor: Record<string, unknown>): GPURenderPassEncoder;
  /** 完成编码并生成命令缓冲。 */
  finish(): GPUCommandBuffer;
}

/** 渲染通道编码器。 */
interface GPURenderPassEncoder {
  /** 绑定 bind group。 */
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  /** 绑定渲染管线。 */
  setPipeline(pipeline: GPURenderPipeline): void;
  /** 发起绘制调用。 */
  draw(vertexCount: number): void;
  /** 结束通道。 */
  end(): void;
}

/** GPU 提交队列。 */
interface GPUQueue {
  /** 写入缓冲区数据。 */
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
  ): void;
  /** 复制外部图像到纹理。 */
  copyExternalImageToTexture(
    source: { source: ImageBitmap },
    destination: { texture: GPUTexture },
    copySize: { width: number; height: number },
  ): void;
  /** 提交命令缓冲。 */
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

/** 画布 WebGPU 上下文。 */
interface GPUCanvasContext {
  /** 配置画布上下文。 */
  configure(configuration: Record<string, unknown>): void;
  /** 获取当前交换链纹理。 */
  getCurrentTexture(): GPUTexture;
}

/** GPU 设备对象。 */
interface GPUDevice {
  /** 设备队列。 */
  readonly queue: GPUQueue;
  /** 设备丢失 promise。 */
  readonly lost: Promise<GPUDeviceLostInfo>;
  /** 未捕获错误回调。 */
  onuncapturederror: ((event: GPUUncapturedErrorEvent) => void) | null;
  /** 创建采样器。 */
  createSampler(descriptor: Record<string, unknown>): GPUSampler;
  /** 创建纹理。 */
  createTexture(descriptor: Record<string, unknown>): GPUTexture;
  /** 创建 Shader 模块。 */
  createShaderModule(descriptor: { code: string }): GPUShaderModule;
  /** 创建缓冲区。 */
  createBuffer(descriptor: Record<string, unknown>): GPUBuffer;
  /** 创建 bind group 布局。 */
  createBindGroupLayout(
    descriptor: Record<string, unknown>,
  ): GPUBindGroupLayout;
  /** 创建 bind group。 */
  createBindGroup(descriptor: Record<string, unknown>): GPUBindGroup;
  /** 创建管线布局。 */
  createPipelineLayout(descriptor: Record<string, unknown>): GPUPipelineLayout;
  /** 创建渲染管线。 */
  createRenderPipeline(descriptor: Record<string, unknown>): GPURenderPipeline;
  /** 创建命令编码器。 */
  createCommandEncoder(): GPUCommandEncoder;
  /** 入栈错误作用域。 */
  pushErrorScope(filter: GPUErrorFilter): void;
  /** 弹出错误作用域。 */
  popErrorScope(): Promise<GPUErrorLike | null>;
}

/** 浏览器导航对象扩展。 */
interface Navigator {
  /** WebGPU 接口。 */
  gpu?: GPU;
}

/** 画布元素扩展。 */
interface HTMLCanvasElement {
  /** 获取 WebGPU 上下文。 */
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}
