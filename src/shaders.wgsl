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

@vertex
fn vertex_fullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // 全屏三角形（无顶点缓冲）。
  // 避免数组索引，提升 WGSL 实现兼容性（Safari）。
  // 预先声明坐标变量。
  var clipCoordinates: vec2f;
  var textureCoordinates: vec2f;
  if (vertexIndex == 0u) {
    // 左下角顶点。
    clipCoordinates = vec2f(-1.0, -1.0);
    textureCoordinates = vec2f(0.0, 0.0);
  } else if (vertexIndex == 1u) {
    // 右下角顶点（延展到 3 以覆盖屏幕）。
    clipCoordinates = vec2f(3.0, -1.0);
    textureCoordinates = vec2f(2.0, 0.0);
  } else {
    // 左上角顶点（延展到 3 以覆盖屏幕）。
    clipCoordinates = vec2f(-1.0, 3.0);
    textureCoordinates = vec2f(0.0, 2.0);
  }

  // 组装输出结构。
  var vertexOutput: VertexOutput;
  // 裁剪空间坐标。
  vertexOutput.clipPosition = vec4f(clipCoordinates, 0.0, 1.0);
  // 纹理坐标。
  vertexOutput.textureCoordinates = textureCoordinates;
  return vertexOutput;
}

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

@fragment
fn fragment_scene(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 对齐 DOM/Canvas 坐标系：y 轴向下增长。
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 输出原图颜色。
  return vec4f(sample_cover_color(textureCoordinates), 1.0);
}

@fragment
fn fragment_present(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 上屏通道将已 cover 映射的场景纹理 1:1 绘制到屏幕。
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 直接采样当前输入纹理。
  return vec4f(
    textureSampleLevel(primaryTexture, linearSampler, textureCoordinates, 0.0).rgb,
    1.0,
  );
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

@fragment
fn fragment_blur_horizontal(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 沿 x 轴方向模糊。
  return vec4f(blur_single_axis(textureCoordinates, vec2f(1.0, 0.0)), 1.0);
}

@fragment
fn fragment_blur_vertical(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 沿 y 轴方向模糊。
  return vec4f(blur_single_axis(textureCoordinates, vec2f(0.0, 1.0)), 1.0);
}

@fragment
fn fragment_overlay(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 读取画布尺寸。
  let canvasSize = sceneUniforms.canvasMetrics.xy;
  // 对齐 DOM/Canvas 坐标系：y 轴向下增长。
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 计算片元在画布中的像素坐标。
  let fragmentPosition = textureCoordinates * canvasSize;

  // 覆盖层矩形（像素空间）。
  let overlayOrigin = sceneUniforms.overlayBounds.xy;
  let overlaySize = sceneUniforms.overlayBounds.zw;
  // 计算覆盖层中心点。
  let overlayCenter = overlayOrigin + overlaySize * 0.5;
  // 计算覆盖层半尺寸。
  let overlayHalfSize = overlaySize * 0.5;
  // 计算片元在覆盖层坐标中的位置。
  let pointInOverlay = fragmentPosition - overlayCenter;
  // 计算覆盖层 SDF。
  let signedDistance = signed_distance_rounded_rect(
    pointInOverlay,
    overlayHalfSize,
    sceneUniforms.opticalParams.x,
  );

  // 抗锯齿宽度（像素）。
  let antialiasWidth = 1.25;
  // 使用递增边界，提升跨实现可移植性。
  // 计算覆盖层填充因子。
  let fillFactor =
    1.0 - smoothstep(-antialiasWidth, antialiasWidth, signedDistance);

  // 静态折射（无噪声）：规则的透镜场。
  // 目标：中心基本不变，边缘沿 SDF 法线有序弯折。
  // 参数：
  // - opticalParams.z：折射强度（边缘最大像素偏移）
  // - opticalParams.w：深度衰减（边缘扭曲向内渗透距离）
  let derivativeStep = 1.0;
  // 计算 x 方向梯度。
  let gradientLeft =
    signed_distance_rounded_rect(
      pointInOverlay + vec2f(derivativeStep, 0.0),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      pointInOverlay - vec2f(derivativeStep, 0.0),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  // 计算 y 方向梯度。
  let gradientTop =
    signed_distance_rounded_rect(
      pointInOverlay + vec2f(0.0, derivativeStep),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      pointInOverlay - vec2f(0.0, derivativeStep),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  // 合成表面梯度。
  let surfaceGradient = vec2f(gradientLeft, gradientTop);
  // 归一化得到表面法线。
  let surfaceNormal = surfaceGradient / max(1e-6, length(surfaceGradient));

  // 距离边缘超过 depth 时为 0，边缘处为 1，形成稳定中心区域。
  let distanceInside = max(0.0, -signedDistance);
  // 深度衰减最小值保障。
  let depthAmount = max(1.0, sceneUniforms.opticalParams.w);
  // 计算边缘衰减因子。
  let edgeFactor = saturate(1.0 - distanceInside / depthAmount);
  // 平方使边缘更集中。
  let edgeFactorSquared = edgeFactor * edgeFactor;

  // 方向：轻微朝透镜中心采样，呈现凸透镜放大感。
  let refractionOffset =
    (-surfaceNormal) * (sceneUniforms.opticalParams.z * edgeFactorSquared);
  // 计算折射后的纹理坐标并夹取。
  let refractedCoordinates = clamp(
    textureCoordinates + refractionOffset / max(vec2f(1.0), canvasSize),
    vec2f(0.0),
    vec2f(1.0),
  );

  // 折射：按偏移 UV 采样背景（无动画）。
  // 磨砂：使用独立 pass 预先模糊的结果。
  let sharpColor = textureSampleLevel(
    primaryTexture,
    linearSampler,
    refractedCoordinates,
    0.0,
  ).rgb;
  // 采样模糊颜色。
  let blurredColor = textureSampleLevel(
    secondaryTexture,
    linearSampler,
    refractedCoordinates,
    0.0,
  ).rgb;
  // 计算磨砂混合比例。
  let frostBlendFactor = saturate(sceneUniforms.lightingParams.x / 4.0);
  // 组合折射颜色。
  let refractedColor = mix(sharpColor, blurredColor, frostBlendFactor);

  // 定向光：在边缘形成类似倒角的高光与阴影。
  // 默认：角度 -45°（左上），强度 0.8。
  // 角度约定：DOM/Canvas 空间中从“上方”顺时针。
  let lightAngle = sceneUniforms.lightingParams.y;
  // 归一化光照强度。
  let lightStrength = saturate(sceneUniforms.lightingParams.z);
  // -45° => (-0.707, -0.707) = 左上。
  // 根据角度构造方向向量。
  let lightDirection = normalize(vec2f(sin(lightAngle), -cos(lightAngle)));
  // 计算法线与光照夹角。
  let normalDotLight = dot(surfaceNormal, lightDirection);
  // 主高光强度。
  let primaryHighlight = saturate(normalDotLight);
  // 次高光强度。
  let secondaryHighlight = saturate(-normalDotLight);
  // 高光宽度：值越小，高光边越细。
  let rimWidth = max(1.5, sceneUniforms.opticalParams.x * 0.07);
  // 高光衰减因子。
  let rimFactor = saturate(1.0 - distanceInside / rimWidth);
  // 内侧高光线因子。
  let rimLineFactor =
    saturate(1.0 - distanceInside / max(0.75, rimWidth * 0.22));

  // 初始为折射后的颜色。
  var compositeColor = refractedColor;
  // 双高光风格：左上更强，右下更弱。
  let primaryHighlightAmount = saturate(
    (0.10 * rimFactor + 1.00 * rimLineFactor) *
      primaryHighlight *
      (lightStrength * 1.65),
  );
  // 次高光混合强度。
  let secondaryHighlightAmount = saturate(
    (0.06 * rimFactor + 0.80 * rimLineFactor) *
      secondaryHighlight *
      (lightStrength * 0.95),
  );
  // 混合主高光。
  compositeColor = mix(compositeColor, vec3f(1.0), primaryHighlightAmount);
  // 混合次高光。
  compositeColor = mix(compositeColor, vec3f(1.0), secondaryHighlightAmount);

  // 折射调试：无染色、无边框，alpha 只取 SDF 填充。
  // 便于判断折射本身是否正常。
  let alpha = fillFactor * saturate(sceneUniforms.overlayColor.a);

  // 预乘 alpha 以匹配混合。
  // 输出最终颜色。
  return vec4f(compositeColor * alpha, alpha);
}
