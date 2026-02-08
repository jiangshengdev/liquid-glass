import { OFFSCREEN_FORMAT } from "../config/params";

/** 渲染阶段所需的布局、bind group 与管线集合。 */
export interface RendererPipelines {
  uniformBindGroupLayout: GPUBindGroupLayout;
  imageBindGroupLayout: GPUBindGroupLayout;
  uniformBindGroup: GPUBindGroup;
  imageBindGroup: GPUBindGroup;
  scenePipeline: GPURenderPipeline;
  blurHorizontalPipeline: GPURenderPipeline;
  blurVerticalPipeline: GPURenderPipeline;
  presentPipeline: GPURenderPipeline;
  overlayPipeline: GPURenderPipeline;
}

interface CreatePipelinesOptions {
  device: GPUDevice;
  module: GPUShaderModule;
  presentationFormat: GPUTextureFormat;
  uniformBuffer: GPUBuffer;
  imageTexture: GPUTexture;
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

  const uniformBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const imageBindGroup = device.createBindGroup({
    layout: imageBindGroupLayout,
    entries: [
      { binding: 0, resource: imageTexture.createView() },
      { binding: 1, resource: imageTexture.createView() },
      { binding: 2, resource: sampler },
    ],
  });

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
