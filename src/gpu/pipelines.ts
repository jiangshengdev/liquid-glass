import { OFFSCREEN_FORMAT } from "../config/params";

export interface RendererPipelines {
  uniformBGL: GPUBindGroupLayout;
  imageBGL: GPUBindGroupLayout;
  uniformBG: GPUBindGroup;
  imageBG: GPUBindGroup;
  scenePipeline: GPURenderPipeline;
  blurHPipeline: GPURenderPipeline;
  blurVPipeline: GPURenderPipeline;
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
  const uniformBGL = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const imageBGL = device.createBindGroupLayout({
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

  const uniformBG = device.createBindGroup({
    layout: uniformBGL,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const imageBG = device.createBindGroup({
    layout: imageBGL,
    entries: [
      { binding: 0, resource: imageTex.createView() },
      { binding: 1, resource: imageTex.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBGL, imageBGL],
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

  const blurHPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_blur_h",
      targets: [{ format: OFFSCREEN_FORMAT }],
    },
    primitive: { topology: "triangle-list" },
  });

  const blurVPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_blur_v",
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
    uniformBGL,
    imageBGL,
    uniformBG,
    imageBG,
    scenePipeline,
    blurHPipeline,
    blurVPipeline,
    presentPipeline,
    overlayPipeline,
  };
}
