//! 场景通道：输出 cover 映射后的原始背景。

/// 场景片元着色器入口。
///
/// # 参数
/// - `vertexOutput`: 顶点阶段插值输出。
///
/// # 返回
/// - cover 采样后的场景颜色。
@fragment
fn fragment_scene(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 对齐 DOM/Canvas 坐标系：y 轴向下增长。
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  var sceneColor = sample_cover_color(textureCoordinates);

  if (sceneUniforms.dispersionParams.z > 0.5) {
    // 当前片元在画布像素空间中的位置。
    let fragmentPosition = textureCoordinates * sceneUniforms.canvasMetrics.xy;
    let htmlOrigin = sceneUniforms.backgroundHtmlBounds.xy;
    let htmlSize = max(sceneUniforms.backgroundHtmlBounds.zw, vec2f(1.0));
    let htmlCoordinates = (fragmentPosition - htmlOrigin) / htmlSize;

    if (
      htmlCoordinates.x >= 0.0 &&
      htmlCoordinates.y >= 0.0 &&
      htmlCoordinates.x <= 1.0 &&
      htmlCoordinates.y <= 1.0
    ) {
      // 仅在 demo bounds 内采样背景 HTML 纹理，避免全屏复制源。
      let htmlColor =
        textureSampleLevel(secondaryTexture, linearSampler, htmlCoordinates, 0.0);
      // 用 HTML alpha 将 demo 元素混合进背景图层，使其参与后续玻璃折射。
      sceneColor = mix(sceneColor, htmlColor.rgb, clamp(htmlColor.a, 0.0, 1.0));
    }
  }

  // 输出合成后的背景颜色。
  return vec4f(sceneColor, 1.0);
}
