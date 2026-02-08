//! 全局共享类型与绑定槽定义。

/// 场景统一参数，按固定布局写入 uniform。
struct Uniforms {
  // 画布宽高、图像宽高比与填充位。
  canvasMetrics: vec4f,
  // 覆盖层位置与尺寸（像素，画布坐标系）。
  overlayBounds: vec4f,
  // 覆盖层半径、描边宽度、折射强度、深度衰减。
  opticalParams: vec4f,
  // 磨砂强度、光照角度（弧度）、光照强度与填充位。
  lightingParams: vec4f,
  // 色散、展散与保留位。
  dispersionParams: vec4f,
  // 覆盖层颜色（非预乘）。
  overlayColor: vec4f,
}

// 统一的场景参数。
@group(0) @binding(0) var<uniform> sceneUniforms: Uniforms;

// Bind group 1 被所有通道共享。
// - scene：primaryTexture = 原始图像
// - blur/present：primaryTexture = 输入纹理（场景纹理 / 模糊纹理）
// - overlay：primaryTexture = 清晰场景，secondaryTexture = 模糊场景
@group(1) @binding(0) var primaryTexture: texture_2d<f32>;
@group(1) @binding(1) var secondaryTexture: texture_2d<f32>;
@group(1) @binding(2) var linearSampler: sampler;

/// 场景顶点阶段到片元阶段的插值输出。
struct VertexOutput {
  // 顶点裁剪空间位置。
  @builtin(position) clipPosition: vec4f,
  // 传递到片元的纹理坐标。
  @location(0) textureCoordinates: vec2f,
};
