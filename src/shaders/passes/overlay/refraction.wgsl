struct OverlayRefraction {
  // 表面法线。
  surfaceNormal: vec2f,
  // 到边缘的内部距离。
  distanceInside: f32,
  // 折射后的采样坐标。
  refractedCoordinates: vec2f,
  // 折射后的基础颜色（已混合磨砂）。
  refractedColor: vec3f,
}

fn compute_overlay_refraction(geometry: OverlayGeometry) -> OverlayRefraction {
  // 静态折射（无噪声）：规则的透镜场。
  // 目标：中心基本不变，边缘沿 SDF 法线有序弯折。
  // 参数：
  // - opticalParams.z：折射强度（边缘最大像素偏移）
  // - opticalParams.w：深度衰减（边缘扭曲向内渗透距离）
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
  // 合成表面梯度。
  let surfaceGradient = vec2f(gradientLeft, gradientTop);
  // 归一化得到表面法线。
  let surfaceNormal = surfaceGradient / max(1e-6, length(surfaceGradient));

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
  let refractedColor = mix(sharpColor, blurredColor, frostBlendFactor);

  return OverlayRefraction(
    surfaceNormal,
    distanceInside,
    refractedCoordinates,
    refractedColor,
  );
}
