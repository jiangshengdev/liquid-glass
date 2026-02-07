import { packUniforms } from "../src/gpu/uniforms";
import type { GlassParams } from "../src/types/common";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function approxEqual(actual: number, expected: number, epsilon = 1e-6): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

export function runUniformTests(): void {
  const params: GlassParams = {
    refraction: 56,
    depth: 0.35,
    dispersion: 0,
    frost: 4,
    splay: 0,
    lightAngleDeg: -45,
    lightStrength: 0.8,
    alpha: 1,
  };

  const out = packUniforms({
    canvasPxW: 1280,
    canvasPxH: 720,
    imageAspect: 16 / 9,
    dpr: 2,
    overlayXCss: 100,
    overlayYCss: 50,
    overlayWCss: 300,
    overlayHCss: 120,
    params,
  });

  assert(out.length === 24, "uniform buffer should contain 24 float values");
  assert(out[0] === 1280, "canvas width should map to index 0");
  assert(out[1] === 720, "canvas height should map to index 1");
  assert(approxEqual(out[2], 16 / 9), "image aspect should map to index 2");

  assert(out[4] === 200, "overlay x should scale with DPR");
  assert(out[5] === 100, "overlay y should scale with DPR");
  assert(out[6] === 600, "overlay width should scale with DPR");
  assert(out[7] === 240, "overlay height should scale with DPR");

  assert(out[10] === 112, "refraction should scale with DPR");
  assert(out[11] === 42, "depth should map from overlay radius and depth ratio");
  assert(out[12] === 8, "frost should scale with DPR");
  assert(
    approxEqual(out[13], (-45 * Math.PI) / 180),
    "light angle should convert to radians",
  );
  assert(
    approxEqual(out[14], 0.8),
    "light strength should map to index 14",
  );
  assert(approxEqual(out[23], 1), "alpha should map to index 23");
}
