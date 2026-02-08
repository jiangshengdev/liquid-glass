import typesWgsl from "./types.wgsl?raw";
import mathWgsl from "./math.wgsl?raw";
import coverSamplingWgsl from "./cover-sampling.wgsl?raw";

/**
 * shared 目录下的通用 WGSL 片段。
 */
export const sharedShaderSource = [
  typesWgsl,
  mathWgsl,
  coverSamplingWgsl,
].join("\n\n");
