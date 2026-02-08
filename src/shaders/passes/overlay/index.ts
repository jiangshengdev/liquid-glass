import overlayGeometryWgsl from "./geometry.wgsl?raw";
import overlayRefractionWgsl from "./refraction.wgsl?raw";
import overlayLightingWgsl from "./lighting.wgsl?raw";

/**
 * overlay 子目录下的辅助片段。
 */
export const overlayShaderSource = [
  overlayGeometryWgsl,
  overlayRefractionWgsl,
  overlayLightingWgsl,
].join("\n\n");
