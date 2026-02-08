//! 覆盖层边缘光照计算。

/// 基于法线方向叠加主次高光。
///
/// # 参数
/// - `refractedColor`: 折射阶段输出的基础颜色。
/// - `surfaceNormal`: 覆盖层法线。
/// - `distanceInside`: 当前片元到边缘的内部距离。
///
/// # 返回
/// - 叠加高光后的最终颜色。
fn apply_overlay_lighting(
  refractedColor: vec3f,
  surfaceNormal: vec2f,
  distanceInside: f32,
) -> vec3f {
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
  return compositeColor;
}
