import typesWgsl from "./shared/types.wgsl?raw";
import mathWgsl from "./shared/math.wgsl?raw";
import coverSamplingWgsl from "./shared/cover-sampling.wgsl?raw";
import vertexWgsl from "./stages/vertex.wgsl?raw";
import blurUtilsWgsl from "./passes/blur-utils.wgsl?raw";
import scenePassWgsl from "./passes/scene-pass.wgsl?raw";
import presentPassWgsl from "./passes/present-pass.wgsl?raw";
import blurPassWgsl from "./passes/blur-pass.wgsl?raw";
import overlayGeometryWgsl from "./passes/overlay/geometry.wgsl?raw";
import overlayRefractionWgsl from "./passes/overlay/refraction.wgsl?raw";
import overlayLightingWgsl from "./passes/overlay/lighting.wgsl?raw";
import overlayPassWgsl from "./passes/overlay-pass.wgsl?raw";

/**
 * 通过 TypeScript 拼接多个 WGSL 片段，避免单文件过大。
 */
export const shaderSource = [
  typesWgsl,
  mathWgsl,
  coverSamplingWgsl,
  vertexWgsl,
  blurUtilsWgsl,
  scenePassWgsl,
  presentPassWgsl,
  blurPassWgsl,
  overlayGeometryWgsl,
  overlayRefractionWgsl,
  overlayLightingWgsl,
  overlayPassWgsl,
].join("\n\n");
