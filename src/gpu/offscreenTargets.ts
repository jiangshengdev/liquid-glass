import { OFFSCREEN_FORMAT } from "../config/params";

export interface OffscreenTargets {
  sceneTexture: GPUTexture;
  horizontalBlurTexture: GPUTexture;
  verticalBlurTexture: GPUTexture;
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
  destroyTexture(targets.sceneTexture);
  destroyTexture(targets.horizontalBlurTexture);
  destroyTexture(targets.verticalBlurTexture);
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

  const sceneTexture = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });
  const horizontalBlurTexture = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });
  const verticalBlurTexture = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });

  return {
    sceneTexture,
    horizontalBlurTexture,
    verticalBlurTexture,
    blurHorizontalBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      sceneTexture,
      sceneTexture,
    ),
    blurVerticalBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      horizontalBlurTexture,
      horizontalBlurTexture,
    ),
    presentBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      sceneTexture,
      sceneTexture,
    ),
    overlayBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      sceneTexture,
      verticalBlurTexture,
    ),
  };
}
