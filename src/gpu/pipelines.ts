import { OFFSCREEN_FORMAT } from "../config/params";

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
  imageTex: GPUTexture;
  sampler: GPUSampler;
}

export function createPipelines({
  device,
  module,
  presentationFormat,
  uniformBuffer,
  imageTex,
  sampler,
}: CreatePipelinesOptions): RendererPipelines {
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
      { binding: 0, resource: imageTex.createView() },
      { binding: 1, resource: imageTex.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBindGroupLayout, imageBindGroupLayout],
  });

  const scenePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_scene",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  const blurHorizontalPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_blur_horizontal",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  const blurVerticalPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_blur_vertical",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  const presentPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_present",
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: "triangle-list" },
  });

  const overlayPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_overlay",
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
