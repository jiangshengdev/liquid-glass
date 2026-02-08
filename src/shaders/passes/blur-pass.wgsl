//! 模糊通道入口。

/// 水平方向模糊片元着色器。
///
/// # 参数
/// - `vertexOutput`: 顶点阶段插值输出。
///
/// # 返回
/// - 水平模糊后的颜色。
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

/// 垂直方向模糊片元着色器。
///
/// # 参数
/// - `vertexOutput`: 顶点阶段插值输出。
///
/// # 返回
/// - 垂直模糊后的颜色。
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
