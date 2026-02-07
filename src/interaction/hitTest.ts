import type { DragMode, GlassRect, ResizeEdges } from "../types/common";
import { sdRoundRect } from "../utils/math";

export interface HitResult {
  mode: DragMode | null;
  edges: ResizeEdges;
}

export function hitTestGlass(
  glass: GlassRect,
  px: number,
  py: number,
  resizeMargin: number,
): HitResult {
  const cx = glass.xCss + glass.wCss * 0.5;
  const cy = glass.yCss + glass.hCss * 0.5;
  const halfW = glass.wCss * 0.5;
  const halfH = glass.hCss * 0.5;
  const rad = glass.hCss * 0.5;
  const d = sdRoundRect(px - cx, py - cy, halfW, halfH, rad);
  const inside = d <= 0;

  // Move uses rounded shape, while resize handles stay on the AABB like design tools.
  const x1 = glass.xCss;
  const y1 = glass.yCss;
  const x2 = glass.xCss + glass.wCss;
  const y2 = glass.yCss + glass.hCss;
  const dx = Math.max(x1 - px, 0, px - x2);
  const dy = Math.max(y1 - py, 0, py - y2);
  const distRect = Math.hypot(dx, dy);
  const active = distRect <= resizeMargin;

  const dl = px - glass.xCss;
  const dr = glass.xCss + glass.wCss - px;
  const dt = py - glass.yCss;
  const db = glass.yCss + glass.hCss - py;
  const adl = Math.abs(dl);
  const adr = Math.abs(dr);
  const adt = Math.abs(dt);
  const adb = Math.abs(db);

  let nearL = adl < resizeMargin;
  let nearR = adr < resizeMargin;
  if (nearL && nearR) {
    nearL = adl <= adr;
    nearR = !nearL;
  }

  let nearT = adt < resizeMargin;
  let nearB = adb < resizeMargin;
  if (nearT && nearB) {
    nearT = adt <= adb;
    nearB = !nearT;
  }

  const edges: ResizeEdges = active
    ? { l: nearL, r: nearR, t: nearT, b: nearB }
    : { l: false, r: false, t: false, b: false };

  const wantsResize = active && (nearL || nearR || nearT || nearB);
  const mode: DragMode | null = wantsResize ? "resize" : inside ? "move" : null;
  return { mode, edges };
}

export function cursorForHit(
  mode: DragMode | null,
  edges: ResizeEdges,
): string {
  if (mode === "resize") {
    const { l, r, t, b } = edges;
    if ((l && t) || (r && b)) return "nwse-resize";
    if ((r && t) || (l && b)) return "nesw-resize";
    if (l || r) return "ew-resize";
    if (t || b) return "ns-resize";
  }
  if (mode === "move") return "move";
  return "";
}
