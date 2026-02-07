import { describe, expect, it } from "vitest";

import { packUniforms } from "../src/gpu/uniforms";
import type { GlassParams } from "../src/types/common";

describe("gpu/uniforms", () => {
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

  it("packs expected layout values with DPR scaling", () => {
    const out = packUniforms({
      canvasWidth: 1280,
      canvasHeight: 720,
      imageAspect: 16 / 9,
      devicePixelRatio: 2,
      overlayLeft: 100,
      overlayTop: 50,
      overlayWidth: 300,
      overlayHeight: 120,
      params,
    });

    expect(out).toHaveLength(24);
    expect(out[0]).toBe(1280);
    expect(out[1]).toBe(720);
    expect(out[2]).toBeCloseTo(16 / 9, 6);

    expect(out[4]).toBe(200);
    expect(out[5]).toBe(100);
    expect(out[6]).toBe(600);
    expect(out[7]).toBe(240);

    expect(out[10]).toBe(112);
    expect(out[11]).toBeCloseTo(42, 6);
    expect(out[12]).toBe(8);
    expect(out[13]).toBeCloseTo((-45 * Math.PI) / 180, 6);
    expect(out[14]).toBeCloseTo(0.8, 6);
    expect(out[23]).toBeCloseTo(1, 6);
  });
});
