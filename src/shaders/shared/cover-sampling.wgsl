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
