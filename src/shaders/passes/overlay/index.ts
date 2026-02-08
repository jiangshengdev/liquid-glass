import overlayGeometryWgsl from "./geometry.wgsl?raw";
import overlayRefractionTypesWgsl from "./refraction-types.wgsl?raw";
import overlayRefractionNormalWgsl from "./refraction-normal.wgsl?raw";
import overlayRefractionSampleWgsl from "./refraction-sample.wgsl?raw";
import overlayRefractionColorWgsl from "./refraction-color.wgsl?raw";
import overlayRefractionWgsl from "./refraction.wgsl?raw";
import overlayLightingWgsl from "./lighting.wgsl?raw";

/**
 * overlay 子目录下的辅助片段。
 */
export const overlayShaderSource = [
  overlayGeometryWgsl,
  overlayRefractionTypesWgsl,
  overlayRefractionNormalWgsl,
  overlayRefractionSampleWgsl,
  overlayRefractionColorWgsl,
  overlayRefractionWgsl,
  overlayLightingWgsl,
].join("\n\n");
