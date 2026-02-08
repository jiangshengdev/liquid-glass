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

struct VertexOutput {
  // 顶点裁剪空间位置。
  @builtin(position) clipPosition: vec4f,
  // 传递到片元的纹理坐标。
  @location(0) textureCoordinates: vec2f,
};

// 将值限制到 [0,1]。
fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn signed_distance_rounded_rect(
  samplePosition: vec2f,
  halfSize: vec2f,
  radius: f32,
) -> f32 {
  // samplePosition、halfSize、radius 处于同一坐标空间。
  // 计算到圆角矩形角部的距离。
  let distanceToCorner = abs(samplePosition) - (halfSize - vec2f(radius));
  // 合成外部距离与内部补偿，返回 SDF。
  return (
    length(max(distanceToCorner, vec2f(0.0))) +
    min(max(distanceToCorner.x, distanceToCorner.y), 0.0) -
    radius
  );
}

fn compute_cover_texture_coordinates(
  textureCoordinates: vec2f,
  containerAspect: f32,
  imageAspect: f32,
) -> vec2f {
  // 覆盖填充容器（cover），裁切溢出方向，不留黑边。
  var resultCoordinates = textureCoordinates;

  if (containerAspect > imageAspect) {
    // 容器更宽：裁切 Y 方向（垂直放大）。
    // 计算缩放比例。
    let scale = containerAspect / max(0.0001, imageAspect);
    // 调整 Y 轴坐标。
    resultCoordinates.y = (textureCoordinates.y - 0.5) / scale + 0.5;
  } else {
    // 容器更高：裁切 X 方向（水平放大）。
    // 计算缩放比例。
    let scale = imageAspect / max(0.0001, containerAspect);
    // 调整 X 轴坐标。
    resultCoordinates.x = (textureCoordinates.x - 0.5) / scale + 0.5;
  }

  // 限制到合法纹理坐标范围。
  return clamp(resultCoordinates, vec2f(0.0), vec2f(1.0));
}

fn sample_cover_color(textureCoordinates: vec2f) -> vec3f {
  // 读取画布尺寸。
  let canvasSize = sceneUniforms.canvasMetrics.xy;
  // 计算容器宽高比。
  let containerAspect = canvasSize.x / max(1.0, canvasSize.y);
  // 读取图像宽高比。
  let imageAspect = max(0.0001, sceneUniforms.canvasMetrics.z);
  // 计算 cover 对应的纹理坐标。
  let imageCoordinates = compute_cover_texture_coordinates(
    textureCoordinates,
    containerAspect,
    imageAspect,
  );
  // 采样原图颜色。
  return textureSampleLevel(primaryTexture, linearSampler, imageCoordinates, 0.0).rgb;
}

fn gaussian_sample_weight(sampleOffset: f32, sigma: f32) -> f32 {
  // 避免 sigma 为 0。
  let sigmaSafe = max(0.0001, sigma);
  // 计算方差倒数。
  let varianceInverse = 1.0 / (sigmaSafe * sigmaSafe);
  // 计算高斯权重。
  return exp(-0.5 * sampleOffset * sampleOffset * varianceInverse);
}

fn blur_single_axis(textureCoordinates: vec2f, blurDirection: vec2f) -> vec3f {
  // 可分离高斯模糊。
  // 获取画布尺寸并避免 0。
  let canvasSize = max(vec2f(1.0), sceneUniforms.canvasMetrics.xy);
  // 计算一个像素的纹理步长。
  let texelSize = 1.0 / canvasSize;
  // 读取磨砂强度并限制范围。
  let frostAmount = clamp(sceneUniforms.lightingParams.x, 0.0, 12.0);
  // 采样半径取整。
  let sampleRadius = i32(round(frostAmount));
  // sigma 与磨砂强度成比例。
  let sigma = frostAmount * 0.5;

  // 累加颜色。
  var colorSum = vec3f(0.0);
  // 累加权重。
  var weightSum = 0.0;

  // 保持统一控制流（sampleRadius 为 uniform）。
  for (
    var sampleIndex: i32 = -sampleRadius;
    sampleIndex <= sampleRadius;
    sampleIndex = sampleIndex + 1
  ) {
    // 当前采样偏移。
    let sampleOffset = f32(sampleIndex);
    // 当前采样权重。
    let sampleWeight = gaussian_sample_weight(sampleOffset, sigma);
    // 计算偏移后的坐标并夹取。
    let offsetCoordinates = clamp(
      textureCoordinates + (blurDirection * sampleOffset) * texelSize,
      vec2f(0.0),
      vec2f(1.0),
    );
    // 累加颜色与权重。
    colorSum =
      colorSum +
      textureSampleLevel(primaryTexture, linearSampler, offsetCoordinates, 0.0).rgb * sampleWeight;
    weightSum = weightSum + sampleWeight;
  }

  // 归一化颜色。
  return colorSum / max(1e-6, weightSum);
}
