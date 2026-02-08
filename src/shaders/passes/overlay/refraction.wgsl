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
