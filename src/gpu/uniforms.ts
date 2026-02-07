import type { GlassParams } from "../types/common";

export interface UniformPackInput {
  canvasPxW: number;
  canvasPxH: number;
  imageAspect: number;
  dpr: number;
  overlayXCss: number;
  overlayYCss: number;
  overlayWCss: number;
  overlayHCss: number;
  params: GlassParams;
}

export function packUniforms(
  input: UniformPackInput,
  out: Float32Array = new Float32Array(24),
): Float32Array {
  const overlayX = input.overlayXCss * input.dpr;
  const overlayY = input.overlayYCss * input.dpr;
  const overlayW = input.overlayWCss * input.dpr;
  const overlayH = input.overlayHCss * input.dpr;
  const overlayR = overlayH * 0.5;

  const refractionPx = input.params.refraction * input.dpr;
  const depthPx = overlayR * input.params.depth;

  const frostPx = input.params.frost * input.dpr;
  const lightAngleRad = (input.params.lightAngleDeg * Math.PI) / 180;

  // Pack uniforms: 6 vec4 = 24 floats.
  out[0] = input.canvasPxW;
  out[1] = input.canvasPxH;
  out[2] = input.imageAspect;
  out[3] = 0;

  out[4] = overlayX;
  out[5] = overlayY;
  out[6] = overlayW;
  out[7] = overlayH;

  out[8] = overlayR;
  out[9] = 0;
  out[10] = refractionPx;
  out[11] = depthPx;

  out[12] = frostPx;
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
