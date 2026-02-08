import blurUtilsWgsl from "./blur-utils.wgsl?raw";
import scenePassWgsl from "./scene-pass.wgsl?raw";
import presentPassWgsl from "./present-pass.wgsl?raw";
import blurPassWgsl from "./blur-pass.wgsl?raw";
import overlayPassWgsl from "./overlay-pass.wgsl?raw";
import { overlayShaderSource } from "./overlay";

/**
 * passes 目录下的渲染通道与辅助逻辑。
 */
export const passesShaderSource = [
  blurUtilsWgsl,
  scenePassWgsl,
  presentPassWgsl,
  blurPassWgsl,
  overlayShaderSource,
  overlayPassWgsl,
].join("\n\n");
