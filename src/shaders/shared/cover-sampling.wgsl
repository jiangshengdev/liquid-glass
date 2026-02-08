//! 背景图 cover 采样工具。

/// 将归一化纹理坐标映射到 cover 模式采样坐标。
///
/// # 参数
/// - `textureCoordinates`: 原始纹理坐标。
/// - `containerAspect`: 容器宽高比。
/// - `imageAspect`: 图像宽高比。
///
/// # 返回
/// - cover 模式下的纹理采样坐标。
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

/// 从主纹理采样 cover 后的颜色。
///
/// # 参数
/// - `textureCoordinates`: 屏幕空间对应的纹理坐标。
///
/// # 返回
/// - 采样得到的 RGB 颜色。
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
