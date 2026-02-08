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

struct OverlayRefractionSample {
  // 到边缘的内部距离。
  distanceInside: f32,
  // 折射后的采样坐标。
  refractedCoordinates: vec2f,
}
