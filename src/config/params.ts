import type { GlassParams } from "../types/common";

export const OFFSCREEN_FORMAT: GPUTextureFormat = "rgba8unorm";

// --- Parameters (official Figma: Refraction / depth / dispersion / frost / splay) ---
// This step only uses Refraction + depth. Others are placeholders (kept at 0).
export const PARAMS: GlassParams = {
  refraction: 56,
  depth: 0.35,
  dispersion: 0,
  frost: 4,
  splay: 0,
  // Light (directional). Angle in degrees, default -45° = top-left.
  lightAngleDeg: -45,
  lightStrength: 0.8,
  // Constant alpha for easy tweaking; 1.0 means the glass fully replaces the background under it.
  alpha: 1.0,
};

// --- Interaction constants (CSS pixels) ---
export const MIN_WIDTH = 240;
export const MIN_HEIGHT = 96;
export const RESIZE_MARGIN = 18;
