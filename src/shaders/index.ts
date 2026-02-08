import commonWgsl from "./common.wgsl?raw";
import vertexWgsl from "./vertex.wgsl?raw";
import scenePassWgsl from "./scene-pass.wgsl?raw";
import presentPassWgsl from "./present-pass.wgsl?raw";
import blurPassWgsl from "./blur-pass.wgsl?raw";
import overlayPassWgsl from "./overlay-pass.wgsl?raw";

/**
 * 通过 TypeScript 拼接多个 WGSL 片段，避免单文件过大。
 */
export const shaderSource = [
  commonWgsl,
  vertexWgsl,
  scenePassWgsl,
  presentPassWgsl,
  blurPassWgsl,
  overlayPassWgsl,
].join("\n\n");
