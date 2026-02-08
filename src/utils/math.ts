/**
 * 将数值限制到指定区间。
 * @param value 输入值。
 * @param min 下界。
 * @param max 上界。
 * @returns 被夹取后的值。
 */
export function clamp(value: number, min: number, max: number): number {
  // 先限制到上界，再限制到下界，保证落入区间。
  return Math.max(min, Math.min(max, value));
}

/**
 * 获取受限的设备像素比，防止过高 DPR 导致性能抖动。
 * @returns 范围在 `[1, 2]` 的 DPR。
 */
export function devicePixelRatioClamped(): number {
  // DPR 过高会放大像素成本，这里统一夹取。
  return clamp(window.devicePixelRatio || 1, 1, 2);
}

/**
 * 计算圆角矩形的符号距离（SDF）。
 * @param pointLeft 点相对中心的 x。
 * @param pointTop 点相对中心的 y。
 * @param halfWidth 半宽。
 * @param halfHeight 半高。
 * @param radius 圆角半径。
 * @returns 符号距离：小于等于 0 表示在形体内部。
 */
export function sdRoundRect(
  pointLeft: number,
  pointTop: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  // 计算点到圆角矩形角部的水平距离。
  const horizontalDistanceFromCorner =
    Math.abs(pointLeft) - (halfWidth - radius);
  // 计算点到圆角矩形角部的垂直距离。
  const verticalDistanceFromCorner = Math.abs(pointTop) - (halfHeight - radius);
  // 角外区域的水平超出量。
  const horizontalDistanceOutside = Math.max(horizontalDistanceFromCorner, 0);
  // 角外区域的垂直超出量。
  const verticalDistanceOutside = Math.max(verticalDistanceFromCorner, 0);
  // 合成外部距离与内部补偿，得到最终 SDF。
  return (
    Math.hypot(horizontalDistanceOutside, verticalDistanceOutside) +
    Math.min(
      Math.max(horizontalDistanceFromCorner, verticalDistanceFromCorner),
      0,
    ) -
    radius
  );
}
