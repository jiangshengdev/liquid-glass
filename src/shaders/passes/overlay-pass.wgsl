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
