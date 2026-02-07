import { OFFSCREEN_FORMAT } from "../config/params";

export interface OffscreenTargets {
  sceneTex: GPUTexture;
  blurTexA: GPUTexture;
  blurTexB: GPUTexture;
  blurHorizontalBindGroup: GPUBindGroup;
  blurVerticalBindGroup: GPUBindGroup;
  presentBindGroup: GPUBindGroup;
  overlayBindGroup: GPUBindGroup;
}

interface CreateOffscreenTargetsOptions {
  device: GPUDevice;
  imageBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
  width: number;
  height: number;
  previous?: OffscreenTargets | null;
}

function createImageBindGroup(
  device: GPUDevice,
  imageBindGroupLayout: GPUBindGroupLayout,
  sampler: GPUSampler,
  primaryTexture: GPUTexture,
  secondaryTexture: GPUTexture,
): GPUBindGroup {
  return device.createBindGroup({
    layout: imageBindGroupLayout,
    entries: [
      { binding: 0, resource: primaryTexture.createView() },
      { binding: 1, resource: secondaryTexture.createView() },
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
  imageBindGroupLayout,
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
    blurHorizontalBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      sceneTex,
      sceneTex,
    ),
    blurVerticalBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      blurTexA,
      blurTexA,
    ),
    presentBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      sceneTex,
      sceneTex,
    ),
    overlayBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      sceneTex,
      blurTexB,
    ),
  };
}
