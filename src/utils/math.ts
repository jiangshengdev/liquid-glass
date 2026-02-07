export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function dprClamped(): number {
  return clamp(window.devicePixelRatio || 1, 1, 2);
}

export function sdRoundRect(px: number, py: number, halfW: number, halfH: number, r: number): number {
  const qx = Math.abs(px) - (halfW - r);
  const qy = Math.abs(py) - (halfH - r);
  const mx = Math.max(qx, 0);
  const my = Math.max(qy, 0);
  return Math.hypot(mx, my) + Math.min(Math.max(qx, qy), 0) - r;
}
