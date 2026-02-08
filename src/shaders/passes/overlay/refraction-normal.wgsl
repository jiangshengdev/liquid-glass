fn compute_overlay_surface_normal(geometry: OverlayGeometry) -> vec2f {
  // 静态折射（无噪声）：规则的透镜场。
  // 目标：中心基本不变，边缘沿 SDF 法线有序弯折。
  let derivativeStep = 1.0;
  // 计算 x 方向梯度。
  let gradientLeft =
    signed_distance_rounded_rect(
      geometry.pointInOverlay + vec2f(derivativeStep, 0.0),
      geometry.overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      geometry.pointInOverlay - vec2f(derivativeStep, 0.0),
      geometry.overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  // 计算 y 方向梯度。
  let gradientTop =
    signed_distance_rounded_rect(
      geometry.pointInOverlay + vec2f(0.0, derivativeStep),
      geometry.overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      geometry.pointInOverlay - vec2f(0.0, derivativeStep),
      geometry.overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  // 合成表面梯度并归一化。
  let surfaceGradient = vec2f(gradientLeft, gradientTop);
  return surfaceGradient / max(1e-6, length(surfaceGradient));
}
