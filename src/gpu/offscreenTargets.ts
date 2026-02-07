import { OFFSCREEN_FORMAT } from "../config/params";

export interface OffscreenTargets {
  sceneTex: GPUTexture;
  blurTexA: GPUTexture;
  blurTexB: GPUTexture;
  blurHBG: GPUBindGroup;
  blurVBG: GPUBindGroup;
  presentBG: GPUBindGroup;
  overlayBG: GPUBindGroup;
}

interface CreateOffscreenTargetsOptions {
  device: GPUDevice;
  imageBGL: GPUBindGroupLayout;
  sampler: GPUSampler;
  width: number;
  height: number;
  previous?: OffscreenTargets | null;
}

function makeImageBG(
  device: GPUDevice,
  imageBGL: GPUBindGroupLayout,
  sampler: GPUSampler,
  texA: GPUTexture,
  texB: GPUTexture,
): GPUBindGroup {
  return device.createBindGroup({
    layout: imageBGL,
    entries: [
      { binding: 0, resource: texA.createView() },
      { binding: 1, resource: texB.createView() },
      { binding: 2, resource: sampler },
    ],
  });
}

function destroyTexture(texture: GPUTexture | null): void {
  if (!texture) return;
  try {
    texture.destroy();
  } catch {
    // ignore
  }
}

export function destroyOffscreenTargets(
  targets: OffscreenTargets | null,
): void {
  if (!targets) return;
  destroyTexture(targets.sceneTex);
  destroyTexture(targets.blurTexA);
  destroyTexture(targets.blurTexB);
}

export function createOffscreenTargets({
  device,
  imageBGL,
  sampler,
  width,
  height,
  previous,
}: CreateOffscreenTargetsOptions): OffscreenTargets {
  destroyOffscreenTargets(previous ?? null);

  const size = { width, height };
  const usage =
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

  const sceneTex = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });
  const blurTexA = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });
  const blurTexB = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });

  return {
    sceneTex,
    blurTexA,
    blurTexB,
    blurHBG: makeImageBG(device, imageBGL, sampler, sceneTex, sceneTex),
    blurVBG: makeImageBG(device, imageBGL, sampler, blurTexA, blurTexA),
    presentBG: makeImageBG(device, imageBGL, sampler, sceneTex, sceneTex),
    overlayBG: makeImageBG(device, imageBGL, sampler, sceneTex, blurTexB),
  };
}
