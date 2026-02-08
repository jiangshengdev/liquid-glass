import { OFFSCREEN_FORMAT } from "../config/params";

/** 渲染阶段所需的布局、bind group 与管线集合。 */
export interface RendererPipelines {
  /** uniform bind group 布局。 */
  uniformBindGroupLayout: GPUBindGroupLayout;
  /** 图像 bind group 布局。 */
  imageBindGroupLayout: GPUBindGroupLayout;
  /** uniform bind group。 */
  uniformBindGroup: GPUBindGroup;
  /** 图像 bind group。 */
  imageBindGroup: GPUBindGroup;
  /** 场景渲染管线。 */
  scenePipeline: GPURenderPipeline;
  /** 横向模糊管线。 */
  blurHorizontalPipeline: GPURenderPipeline;
  /** 纵向模糊管线。 */
  blurVerticalPipeline: GPURenderPipeline;
  /** 上屏管线。 */
  presentPipeline: GPURenderPipeline;
  /** 叠加管线。 */
  overlayPipeline: GPURenderPipeline;
}

interface CreatePipelinesOptions {
  /** GPU 设备。 */
  device: GPUDevice;
  /** Shader 模块。 */
  module: GPUShaderModule;
  /** 交换链格式。 */
  presentationFormat: GPUTextureFormat;
  /** uniform 缓冲区。 */
  uniformBuffer: GPUBuffer;
  /** 图像纹理。 */
  imageTexture: GPUTexture;
  /** 采样器。 */
  sampler: GPUSampler;
}

/**
 * 创建全部渲染管线与绑定对象。
 * @param options 构建管线的输入依赖。
 * @returns 渲染管线集合。
 */
export function createPipelines({
  device,
  module,
  presentationFormat,
  uniformBuffer,
  imageTexture,
  sampler,
}: CreatePipelinesOptions): RendererPipelines {
  // uniform：所有通道共享场景参数。
  const uniformBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  // 图像：采样原图与模糊图。
  const imageBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
    ],
  });

  // 创建 uniform bind group。
  const uniformBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // 创建图像 bind group。
  const imageBindGroup = device.createBindGroup({
    layout: imageBindGroupLayout,
    entries: [
      // 主纹理。
      { binding: 0, resource: imageTexture.createView() },
      // 次纹理。
      { binding: 1, resource: imageTexture.createView() },
      // 采样器。
      { binding: 2, resource: sampler },
    ],
  });

  // 合并 uniform 与图像布局。
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBindGroupLayout, imageBindGroupLayout],
  });

  // 通道 1：将原图覆盖映射到离屏场景纹理。
  const scenePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertex_fullscreen" },
    fragment: {
      module,
      entryPoint: "fragment_scene",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  // 通道 2：横向高斯模糊。
  const blurHorizontalPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertex_fullscreen" },
    fragment: {
      module,
      entryPoint: "fragment_blur_horizontal",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  // 通道 3：纵向高斯模糊。
  const blurVerticalPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertex_fullscreen" },
    fragment: {
      module,
      entryPoint: "fragment_blur_vertical",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  // 上屏通道：将离屏场景纹理直接绘制到交换链纹理。
  const presentPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertex_fullscreen" },
    fragment: {
      module,
      entryPoint: "fragment_present",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  // 叠加通道：在最终画面上叠加玻璃折射与磨砂效果。
  const overlayPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertex_fullscreen" },
    fragment: {
      module,
      entryPoint: "fragment_overlay",
      targets: [
        {
          format: presentationFormat,
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });

  return {
    uniformBindGroupLayout,
    imageBindGroupLayout,
    uniformBindGroup,
    imageBindGroup,
    scenePipeline,
    blurHorizontalPipeline,
    blurVerticalPipeline,
    presentPipeline,
    overlayPipeline,
  };
}
