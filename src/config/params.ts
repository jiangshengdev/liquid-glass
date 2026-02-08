import type { GlassParams } from "../types/common";

/** 离屏渲染纹理格式。 */
export const OFFSCREEN_FORMAT: GPUTextureFormat = "rgba8unorm";

// --- 玻璃参数（对应 Figma: Refraction / depth / dispersion / frost / splay）---
// 当前阶段主要使用 Refraction + depth，其余参数先保留占位值。
export const PARAMS: GlassParams = {
  // 折射强度。
  refraction: 56,
  // 深度衰减比例。
  depth: 0.35,
  // 色散强度。
  dispersion: 0,
  // 磨砂强度。
  frost: 4,
  // 展散强度。
  splay: 0,
  // 定向光：角度单位为度，默认 -45° 表示左上方向。
  lightAngleDeg: -45,
  // 光照强度。
  lightStrength: 0.8,
  // 常量透明度：1.0 表示玻璃区域完全覆盖其下方背景。
  alpha: 1.0,
};

// --- 交互常量（单位：CSS 像素）---
// 玻璃最小宽度。
export const MIN_WIDTH = 240;
// 玻璃最小高度。
export const MIN_HEIGHT = 96;
// 缩放命中边距。
export const RESIZE_MARGIN = 18;
