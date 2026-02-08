fn compute_overlay_refracted_color(refractedCoordinates: vec2f) -> vec3f {
  // 折射：按偏移 UV 采样背景（无动画）。
  // 磨砂：使用独立 pass 预先模糊的结果。
  let sharpColor = textureSampleLevel(
    primaryTexture,
    linearSampler,
    refractedCoordinates,
    0.0,
  ).rgb;
  // 采样模糊颜色。
  let blurredColor = textureSampleLevel(
    secondaryTexture,
    linearSampler,
    refractedCoordinates,
    0.0,
  ).rgb;
  // 计算磨砂混合比例。
  let frostBlendFactor = saturate(sceneUniforms.lightingParams.x / 4.0);
  // 组合折射颜色。
  return mix(sharpColor, blurredColor, frostBlendFactor);
}
