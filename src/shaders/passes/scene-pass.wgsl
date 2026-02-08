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
  // 输出原图颜色。
  return vec4f(sample_cover_color(textureCoordinates), 1.0);
}
