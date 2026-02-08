fn compute_overlay_refraction_sample(
  geometry: OverlayGeometry,
  surfaceNormal: vec2f,
) -> OverlayRefractionSample {
  // 参数：
  // - opticalParams.z：折射强度（边缘最大像素偏移）
  // - opticalParams.w：深度衰减（边缘扭曲向内渗透距离）

  // 距离边缘超过 depth 时为 0，边缘处为 1，形成稳定中心区域。
  let distanceInside = max(0.0, -geometry.signedDistance);
  // 深度衰减最小值保障。
  let depthAmount = max(1.0, sceneUniforms.opticalParams.w);
  // 计算边缘衰减因子。
  let edgeFactor = saturate(1.0 - distanceInside / depthAmount);
  // 平方使边缘更集中。
  let edgeFactorSquared = edgeFactor * edgeFactor;

  // 方向：轻微朝透镜中心采样，呈现凸透镜放大感。
  let refractionOffset =
    (-surfaceNormal) * (sceneUniforms.opticalParams.z * edgeFactorSquared);
  // 计算折射后的纹理坐标并夹取。
  let refractedCoordinates = clamp(
    geometry.textureCoordinates + refractionOffset / max(vec2f(1.0), geometry.canvasSize),
    vec2f(0.0),
    vec2f(1.0),
  );

  return OverlayRefractionSample(distanceInside, refractedCoordinates);
}
