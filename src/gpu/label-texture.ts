interface GpuTextureUsageFlags {
  /** 作为纹理绑定。 */
  TEXTURE_BINDING: number;
  /** 作为复制目标。 */
  COPY_DST: number;
  /** 作为渲染附件。 */
  RENDER_ATTACHMENT: number;
}

interface BuildLabelTextureDescriptorOptions {
  /** 纹理宽度，单位为设备像素。 */
  width: number;
  /** 纹理高度，单位为设备像素。 */
  height: number;
  /** 纹理 usage 常量集合，测试可传入轻量替身。 */
  usage?: GpuTextureUsageFlags;
}

interface ComputeLabelTextureSizeOptions {
  /** 状态层期望的 label 宽度，单位为 CSS 像素。 */
  cssWidth: number;
  /** 状态层期望的 label 高度，单位为 CSS 像素。 */
  cssHeight: number;
  /** 当前设备像素比。 */
  devicePixelRatio: number;
  /** DOM 实际布局宽度，单位为 CSS 像素。 */
  renderedCssWidth?: number;
  /** DOM 实际布局高度，单位为 CSS 像素。 */
  renderedCssHeight?: number;
}

/** label 纹理尺寸。 */
export interface LabelTextureSize {
  /** 纹理宽度，单位为设备像素。 */
  width: number;
  /** 纹理高度，单位为设备像素。 */
  height: number;
}

/**
 * 构建 HTML-in-Canvas label 纹理描述符。
 * @param options 纹理尺寸与可选 usage 常量。
 * @returns 可传给 `GPUDevice.createTexture()` 的描述符。
 */
export function buildLabelTextureDescriptor({
  width,
  height,
  usage = GPUTextureUsage,
}: BuildLabelTextureDescriptorOptions): Record<string, unknown> {
  return {
    size: { width, height },
    format: "rgba8unorm",
    usage:
      usage.TEXTURE_BINDING | usage.COPY_DST | usage.RENDER_ATTACHMENT,
  };
}

/**
 * 计算足以容纳 HTML-in-Canvas 元素复制范围的 label 纹理尺寸。
 * @param options CSS 尺寸、DPR 与可选 DOM 实际布局尺寸。
 * @returns 向上取整后的设备像素尺寸。
 */
export function computeLabelTextureSize({
  cssWidth,
  cssHeight,
  devicePixelRatio,
  renderedCssWidth,
  renderedCssHeight,
}: ComputeLabelTextureSizeOptions): LabelTextureSize {
  const effectiveCssWidth = Math.max(cssWidth, renderedCssWidth ?? 0);
  const effectiveCssHeight = Math.max(cssHeight, renderedCssHeight ?? 0);

  return {
    width: Math.max(1, Math.ceil(effectiveCssWidth * devicePixelRatio)),
    height: Math.max(1, Math.ceil(effectiveCssHeight * devicePixelRatio)),
  };
}
