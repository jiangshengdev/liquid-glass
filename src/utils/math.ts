/**
 * 将数值限制到指定区间。
 * @param value 输入值。
 * @param min 下界。
 * @param max 上界。
 * @returns 被夹取后的值。
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 获取受限的设备像素比，防止过高 DPR 导致性能抖动。
 * @returns 范围在 `[1, 2]` 的 DPR。
 */
export function devicePixelRatioClamped(): number {
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
  const horizontalDistanceFromCorner =
    Math.abs(pointLeft) - (halfWidth - radius);
  const verticalDistanceFromCorner = Math.abs(pointTop) - (halfHeight - radius);
  const horizontalDistanceOutside = Math.max(horizontalDistanceFromCorner, 0);
  const verticalDistanceOutside = Math.max(verticalDistanceFromCorner, 0);
  return (
    Math.hypot(horizontalDistanceOutside, verticalDistanceOutside) +
    Math.min(
      Math.max(horizontalDistanceFromCorner, verticalDistanceFromCorner),
      0,
    ) -
    radius
  );
}
