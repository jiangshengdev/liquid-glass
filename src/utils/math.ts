export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function devicePixelRatioClamped(): number {
  return clamp(window.devicePixelRatio || 1, 1, 2);
}

export function sdRoundRect(
  pointLeft: number,
  pointTop: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const horizontalDistanceFromCorner =
    Math.abs(pointLeft) - (halfWidth - radius);
  const verticalDistanceFromCorner =
    Math.abs(pointTop) - (halfHeight - radius);
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
