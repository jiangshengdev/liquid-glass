import { OFFSCREEN_FORMAT } from "../config/params";

/** 离屏渲染所需纹理与对应 bind group 集合。 */
export interface OffscreenTargets {
  /** 场景纹理。 */
  sceneTexture: GPUTexture;
  /** 横向模糊纹理。 */
  horizontalBlurTexture: GPUTexture;
  /** 纵向模糊纹理。 */
  verticalBlurTexture: GPUTexture;
  /** 横向模糊 bind group。 */
  blurHorizontalBindGroup: GPUBindGroup;
  /** 纵向模糊 bind group。 */
  blurVerticalBindGroup: GPUBindGroup;
  /** 上屏 bind group。 */
  presentBindGroup: GPUBindGroup;
  /** 叠加 bind group。 */
  overlayBindGroup: GPUBindGroup;
}

interface CreateOffscreenTargetsOptions {
  /** GPU 设备。 */
  device: GPUDevice;
  /** 图像 bind group 布局。 */
  imageBindGroupLayout: GPUBindGroupLayout;
  /** 采样器。 */
  sampler: GPUSampler;
  /** 纹理宽度。 */
  width: number;
  /** 纹理高度。 */
  height: number;
  /** 旧的离屏目标（可选）。 */
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
  // 创建图像采样 bind group。
  return device.createBindGroup({
    layout: imageBindGroupLayout,
    entries: [
      // 主纹理绑定。
      { binding: 0, resource: primaryTexture.createView() },
      // 次纹理绑定。
      { binding: 1, resource: secondaryTexture.createView() },
      // 采样器绑定。
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
  // 空纹理直接跳过。
  if (!texture) return;
  try {
    // 显式销毁释放显存。
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
  // 空对象直接返回。
  if (!targets) return;
  // 释放场景纹理。
  destroyTexture(targets.sceneTexture);
  // 释放横向模糊纹理。
  destroyTexture(targets.horizontalBlurTexture);
  // 释放纵向模糊纹理。
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

  // 统一尺寸描述。
  const size = { width, height };
  // 统一纹理用途。
  const usage =
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

  // 创建场景纹理。
  const sceneTexture = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });
  // 创建横向模糊纹理。
  const horizontalBlurTexture = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });
  // 创建纵向模糊纹理。
  const verticalBlurTexture = device.createTexture({
    size,
    format: OFFSCREEN_FORMAT,
    usage,
  });

  // 构建并返回 bind group 集合。
  return {
    sceneTexture,
    horizontalBlurTexture,
    verticalBlurTexture,
    blurHorizontalBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      // 横向模糊读取场景纹理。
      sceneTexture,
      // 兼容接口，次纹理也指向场景纹理。
      sceneTexture,
    ),
    blurVerticalBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      // 纵向模糊读取横向模糊结果。
      horizontalBlurTexture,
      // 兼容接口，次纹理也指向横向模糊结果。
      horizontalBlurTexture,
    ),
    presentBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      // 上屏使用清晰场景纹理。
      sceneTexture,
      // 兼容接口，次纹理仍为场景纹理。
      sceneTexture,
    ),
    overlayBindGroup: createImageBindGroup(
      device,
      imageBindGroupLayout,
      sampler,
      // 叠加使用清晰场景纹理。
      sceneTexture,
      // 叠加使用模糊场景纹理。
      verticalBlurTexture,
    ),
  };
}
