@fragment
fn fragment_overlay(vertexOutput: VertexOutput) -> @location(0) vec4f {
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

  // 静态折射（无噪声）：规则的透镜场。
  // 目标：中心基本不变，边缘沿 SDF 法线有序弯折。
  // 参数：
  // - opticalParams.z：折射强度（边缘最大像素偏移）
  // - opticalParams.w：深度衰减（边缘扭曲向内渗透距离）
  let derivativeStep = 1.0;
  // 计算 x 方向梯度。
  let gradientLeft =
    signed_distance_rounded_rect(
      pointInOverlay + vec2f(derivativeStep, 0.0),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      pointInOverlay - vec2f(derivativeStep, 0.0),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  // 计算 y 方向梯度。
  let gradientTop =
    signed_distance_rounded_rect(
      pointInOverlay + vec2f(0.0, derivativeStep),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      pointInOverlay - vec2f(0.0, derivativeStep),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  // 合成表面梯度。
  let surfaceGradient = vec2f(gradientLeft, gradientTop);
  // 归一化得到表面法线。
  let surfaceNormal = surfaceGradient / max(1e-6, length(surfaceGradient));

  // 距离边缘超过 depth 时为 0，边缘处为 1，形成稳定中心区域。
  let distanceInside = max(0.0, -signedDistance);
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
    textureCoordinates + refractionOffset / max(vec2f(1.0), canvasSize),
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

  // 定向光：在边缘形成类似倒角的高光与阴影。
  // 默认：角度 -45°（左上），强度 0.8。
  // 角度约定：DOM/Canvas 空间中从“上方”顺时针。
  let lightAngle = sceneUniforms.lightingParams.y;
  // 归一化光照强度。
  let lightStrength = saturate(sceneUniforms.lightingParams.z);
  // -45° => (-0.707, -0.707) = 左上。
  // 根据角度构造方向向量。
  let lightDirection = normalize(vec2f(sin(lightAngle), -cos(lightAngle)));
  // 计算法线与光照夹角。
  let normalDotLight = dot(surfaceNormal, lightDirection);
  // 主高光强度。
  let primaryHighlight = saturate(normalDotLight);
  // 次高光强度。
  let secondaryHighlight = saturate(-normalDotLight);
  // 高光宽度：值越小，高光边越细。
  let rimWidth = max(1.5, sceneUniforms.opticalParams.x * 0.07);
  // 高光衰减因子。
  let rimFactor = saturate(1.0 - distanceInside / rimWidth);
  // 内侧高光线因子。
  let rimLineFactor =
    saturate(1.0 - distanceInside / max(0.75, rimWidth * 0.22));

  // 初始为折射后的颜色。
  var compositeColor = refractedColor;
  // 双高光风格：左上更强，右下更弱。
  let primaryHighlightAmount = saturate(
    (0.10 * rimFactor + 1.00 * rimLineFactor) *
      primaryHighlight *
      (lightStrength * 1.65),
  );
  // 次高光混合强度。
  let secondaryHighlightAmount = saturate(
    (0.06 * rimFactor + 0.80 * rimLineFactor) *
      secondaryHighlight *
      (lightStrength * 0.95),
  );
  // 混合主高光。
  compositeColor = mix(compositeColor, vec3f(1.0), primaryHighlightAmount);
  // 混合次高光。
  compositeColor = mix(compositeColor, vec3f(1.0), secondaryHighlightAmount);

  // 折射调试：无染色、无边框，alpha 只取 SDF 填充。
  // 便于判断折射本身是否正常。
  let alpha = fillFactor * saturate(sceneUniforms.overlayColor.a);

  // 预乘 alpha 以匹配混合。
  // 输出最终颜色。
  return vec4f(compositeColor * alpha, alpha);
}
