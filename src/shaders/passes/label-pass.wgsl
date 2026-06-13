//! 文本覆盖层通道：将 HTML-in-Canvas label 纹理覆盖到玻璃按钮上方。

/// 文本覆盖层片元入口。
///
/// # 参数
/// - `vertexOutput`: 顶点阶段插值输出。
///
/// # 返回
/// - label 纹理采样颜色；按钮区域外透明。
@fragment
fn fragment_label(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 对齐 DOM/Canvas 坐标系：y 轴向下增长。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 当前片元在画布像素空间中的位置。
  let fragmentPosition = textureCoordinates * sceneUniforms.canvasMetrics.xy;
  // label 覆盖区域沿用玻璃按钮 bounds。
  let labelOrigin = sceneUniforms.overlayBounds.xy;
  let labelSize = max(sceneUniforms.overlayBounds.zw, vec2f(1.0));
  // 计算片元在 label 内部的归一化坐标。
  let labelCoordinates = (fragmentPosition - labelOrigin) / labelSize;

  if (
    labelCoordinates.x < 0.0 ||
    labelCoordinates.y < 0.0 ||
    labelCoordinates.x > 1.0 ||
    labelCoordinates.y > 1.0
  ) {
    return vec4f(0.0);
  }

  // 采样 HTML-in-Canvas 上传的 label 纹理。
  let labelColor =
    textureSampleLevel(primaryTexture, linearSampler, labelCoordinates, 0.0);
  // 透明像素直接透出底层玻璃按钮。
  return labelColor;
}
