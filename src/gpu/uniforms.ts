import type { GlassParams } from "../types/common";

/** uniform 打包输入参数。 */
export interface UniformPackInput {
  canvasWidth: number;
  canvasHeight: number;
  imageAspect: number;
  devicePixelRatio: number;
  overlayLeft: number;
  overlayTop: number;
  overlayWidth: number;
  overlayHeight: number;
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
  const overlayRadius = overlayHeight * 0.5;

  const refractionAmount = input.params.refraction * input.devicePixelRatio;
  const depthAmount = overlayRadius * input.params.depth;

  const frostAmount = input.params.frost * input.devicePixelRatio;
  const lightAngleRad = (input.params.lightAngleDeg * Math.PI) / 180;

  // 按 6 个 vec4 顺序写入，共 24 个 float。
  out[0] = input.canvasWidth;
  out[1] = input.canvasHeight;
  out[2] = input.imageAspect;
  out[3] = 0;

  out[4] = overlayLeft;
  out[5] = overlayTop;
  out[6] = overlayWidth;
  out[7] = overlayHeight;

  out[8] = overlayRadius;
  out[9] = 0;
  out[10] = refractionAmount;
  out[11] = depthAmount;

  out[12] = frostAmount;
  out[13] = lightAngleRad;
  out[14] = input.params.lightStrength;
  out[15] = 0;

  out[16] = input.params.dispersion;
  out[17] = input.params.splay;
  out[18] = 0;
  out[19] = 0;

  out[20] = 1.0;
  out[21] = 1.0;
  out[22] = 1.0;
  out[23] = input.params.alpha;

  return out;
}
