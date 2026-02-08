//! 高斯模糊辅助函数。

/// 计算指定偏移位置的高斯权重。
///
/// # 参数
/// - `sampleOffset`: 当前采样点相对中心的像素偏移。
/// - `sigma`: 高斯分布标准差。
///
/// # 返回
/// - 当前偏移对应的权重值。
fn gaussian_sample_weight(sampleOffset: f32, sigma: f32) -> f32 {
  // 避免 sigma 为 0。
  let sigmaSafe = max(0.0001, sigma);
  // 计算方差倒数。
  let varianceInverse = 1.0 / (sigmaSafe * sigmaSafe);
  // 计算高斯权重。
  return exp(-0.5 * sampleOffset * sampleOffset * varianceInverse);
}

/// 对输入纹理执行单轴可分离高斯模糊。
///
/// # 参数
/// - `textureCoordinates`: 当前片元纹理坐标。
/// - `blurDirection`: 模糊方向（x 或 y 轴）。
///
/// # 返回
/// - 模糊后的 RGB 颜色。
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
