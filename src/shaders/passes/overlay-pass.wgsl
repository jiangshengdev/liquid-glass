//! 覆盖层通道入口：折射 + 边缘光照 + alpha 合成。

/// 覆盖层片元着色器入口。
///
/// # 参数
/// - `vertexOutput`: 顶点阶段插值输出。
///
/// # 返回
/// - 折射与高光合成后的预乘 alpha 颜色。
@fragment
fn fragment_overlay(vertexOutput: VertexOutput) -> @location(0) vec4f {
  let geometry = compute_overlay_geometry(vertexOutput);
  let refraction = compute_overlay_refraction(geometry);
  let compositeColor = apply_overlay_lighting(
    refraction.refractedColor,
    refraction.surfaceNormal,
    refraction.distanceInside,
  );

  // 折射调试：无染色、无边框，alpha 只取 SDF 填充。
  // 便于判断折射本身是否正常。
  let alpha = geometry.fillFactor * saturate(sceneUniforms.overlayColor.a);

  // 预乘 alpha 以匹配混合。
  // 输出最终颜色。
  return vec4f(compositeColor * alpha, alpha);
}
