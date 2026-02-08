import { sharedShaderSource } from "./shared";
import { stagesShaderSource } from "./stages";
import { passesShaderSource } from "./passes";

/**
 * 通过 TypeScript 拼接多个 WGSL 片段，避免单文件过大。
 */
export const shaderSource = [
  sharedShaderSource,
  stagesShaderSource,
  passesShaderSource,
].join("\n\n");
