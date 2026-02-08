//! 顶点阶段入口。

/// 生成全屏三角形顶点与对应纹理坐标。
///
/// # 参数
/// - `vertexIndex`: 内建顶点索引（0~2）。
///
/// # 返回
/// - 包含裁剪空间位置与纹理坐标的 `VertexOutput`。
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
