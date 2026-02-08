//! 覆盖层几何信息计算。

/// 覆盖层片元几何上下文。
struct OverlayGeometry {
  // 画布尺寸。
  canvasSize: vec2f,
  // 当前片元纹理坐标（已翻转 y）。
  textureCoordinates: vec2f,
  // 当前片元在覆盖层中心坐标系中的位置。
  pointInOverlay: vec2f,
  // 覆盖层半尺寸。
  overlayHalfSize: vec2f,
  // 覆盖层 SDF。
  signedDistance: f32,
  // 覆盖层填充因子。
  fillFactor: f32,
}

/// 从片元输入构建覆盖层几何信息。
///
/// # 参数
/// - `vertexOutput`: 顶点阶段插值输出。
///
/// # 返回
/// - 当前片元的覆盖层几何上下文。
fn compute_overlay_geometry(vertexOutput: VertexOutput) -> OverlayGeometry {
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

  return OverlayGeometry(
    canvasSize,
    textureCoordinates,
    pointInOverlay,
    overlayHalfSize,
    signedDistance,
    fillFactor,
  );
}
