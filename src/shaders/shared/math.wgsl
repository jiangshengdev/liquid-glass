//! 数学辅助函数。

// 将值限制到 [0,1]。
/// 将标量钳制到 [0,1] 区间。
///
/// # 参数
/// - `value`: 输入标量。
///
/// # 返回
/// - 限制到 [0,1] 的结果。
fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

/// 计算点到圆角矩形边界的有符号距离。
///
/// # 参数
/// - `samplePosition`: 采样点（相对圆角矩形中心）。
/// - `halfSize`: 圆角矩形半尺寸。
/// - `radius`: 圆角半径。
///
/// # 返回
/// - SDF 值（内部为负，边界为 0，外部为正）。
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
