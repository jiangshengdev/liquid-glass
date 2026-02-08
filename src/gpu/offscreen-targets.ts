import { OFFSCREEN_FORMAT } from "../config/params";

/** 离屏渲染所需纹理与对应 bind group 集合。 */
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

/**
 * 为给定纹理创建统一的图像采样 bind group。
 * @param device GPU 设备。
 * @param imageBindGroupLayout 图像 bind group 布局。
 * @param sampler 采样器。
 * @param primaryTexture 主纹理（binding 0）。
 * @param secondaryTexture 次纹理（binding 1）。
 * @returns 可直接绑定到片元阶段的 bind group。
 */
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

/**
 * 安全销毁纹理。
 * @param texture 目标纹理。
 * @returns 无返回值。
 */
function destroyTexture(texture: GPUTexture | null): void {
  if (!texture) return;
  try {
    texture.destroy();
  } catch {
    // 销毁阶段异常可忽略，避免影响后续重建。
  }
}

/**
 * 销毁整组离屏纹理资源。
 * @param targets 离屏目标集合。
 * @returns 无返回值。
 */
export function destroyOffscreenTargets(
  targets: OffscreenTargets | null,
): void {
  if (!targets) return;
  destroyTexture(targets.sceneTexture);
  destroyTexture(targets.horizontalBlurTexture);
  destroyTexture(targets.verticalBlurTexture);
}

/**
 * 创建离屏渲染目标，并复用统一的 bind group 结构。
 * @param options 创建参数。
 * @returns 新的离屏目标集合。
 */
export function createOffscreenTargets({
  device,
  imageBindGroupLayout,
  sampler,
  width,
  height,
  previous,
}: CreateOffscreenTargetsOptions): OffscreenTargets {
  // 重建前先释放旧纹理，避免显存泄漏。
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
