import type { GlassParams } from "../types/common";

/** uniform 打包输入参数。 */
export interface UniformPackInput {
  /** 画布像素宽度。 */
  canvasWidth: number;
  /** 画布像素高度。 */
  canvasHeight: number;
  /** 图像宽高比。 */
  imageAspect: number;
  /** 设备像素比。 */
  devicePixelRatio: number;
  /** 覆盖层左侧坐标（CSS 像素）。 */
  overlayLeft: number;
  /** 覆盖层顶部坐标（CSS 像素）。 */
  overlayTop: number;
  /** 覆盖层宽度（CSS 像素）。 */
  overlayWidth: number;
  /** 覆盖层高度（CSS 像素）。 */
  overlayHeight: number;
  /** 玻璃参数。 */
  params: GlassParams;
}

/**
 * 将业务参数按 WGSL 约定布局打包到 `Float32Array`。
 * @param input 业务输入参数。
 * @param out 输出缓冲区，默认创建 24 长度数组。
 * @returns 打包后的浮点数组（与 `out` 同引用）。
 */
export function packUniforms(
  input: UniformPackInput,
  out: Float32Array = new Float32Array(24),
): Float32Array {
  // 将 CSS 像素统一转换到设备像素空间。
  const overlayLeft = input.overlayLeft * input.devicePixelRatio;
  const overlayTop = input.overlayTop * input.devicePixelRatio;
  const overlayWidth = input.overlayWidth * input.devicePixelRatio;
  const overlayHeight = input.overlayHeight * input.devicePixelRatio;
  // 半径取高度的一半。
  const overlayRadius = overlayHeight * 0.5;

  // 折射强度转换到设备像素。
  const refractionAmount = input.params.refraction * input.devicePixelRatio;
  // 深度衰减与半径相关。
  const depthAmount = overlayRadius * input.params.depth;

  // 磨砂强度转换到设备像素。
  const frostAmount = input.params.frost * input.devicePixelRatio;
  // 光照角度转为弧度。
  const lightAngleRad = (input.params.lightAngleDeg * Math.PI) / 180;

  // 按 6 个 vec4 顺序写入，共 24 个 float。
  // canvasMetrics
  out[0] = input.canvasWidth;
  out[1] = input.canvasHeight;
  out[2] = input.imageAspect;
  out[3] = 0;

  // overlayBounds
  out[4] = overlayLeft;
  out[5] = overlayTop;
  out[6] = overlayWidth;
  out[7] = overlayHeight;

  // opticalParams
  out[8] = overlayRadius;
  out[9] = 0;
  out[10] = refractionAmount;
  out[11] = depthAmount;

  // lightingParams
  out[12] = frostAmount;
  out[13] = lightAngleRad;
  out[14] = input.params.lightStrength;
  out[15] = 0;

  // dispersionParams
  out[16] = input.params.dispersion;
  out[17] = input.params.splay;
  out[18] = 0;
  out[19] = 0;

  // overlayColor
  out[20] = 1.0;
  out[21] = 1.0;
  out[22] = 1.0;
  out[23] = input.params.alpha;

  return out;
}
