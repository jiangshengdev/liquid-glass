//! 覆盖层折射主流程组装。

/// 汇总法线、采样坐标与折射颜色。
///
/// # 参数
/// - `geometry`: 覆盖层几何上下文。
///
/// # 返回
/// - 覆盖层折射阶段完整输出。
fn compute_overlay_refraction(geometry: OverlayGeometry) -> OverlayRefraction {
  let surfaceNormal = compute_overlay_surface_normal(geometry);
  let refractionSample = compute_overlay_refraction_sample(geometry, surfaceNormal);
  let refractedColor = compute_overlay_refracted_color(refractionSample.refractedCoordinates);

  return OverlayRefraction(
    surfaceNormal,
    refractionSample.distanceInside,
    refractionSample.refractedCoordinates,
    refractedColor,
  );
}
