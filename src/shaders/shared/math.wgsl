// 将值限制到 [0,1]。
fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn signed_distance_rounded_rect(
  samplePosition: vec2f,
  halfSize: vec2f,
  radius: f32,
) -> f32 {
  // samplePosition、halfSize、radius 处于同一坐标空间。
  // 计算到圆角矩形角部的距离。
  let distanceToCorner = abs(samplePosition) - (halfSize - vec2f(radius));
  // 合成外部距离与内部补偿，返回 SDF。
  return (
    length(max(distanceToCorner, vec2f(0.0))) +
    min(max(distanceToCorner.x, distanceToCorner.y), 0.0) -
    radius
  );
}
