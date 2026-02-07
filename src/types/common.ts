export type DragMode = "move" | "resize";

export interface ResizeEdges {
  l: boolean;
  r: boolean;
  t: boolean;
  b: boolean;
}

export interface GlassRect {
  xCss: number;
  yCss: number;
  wCss: number;
  hCss: number;
}

export interface GlassParams {
  refraction: number;
  depth: number;
  dispersion: number;
  frost: number;
  splay: number;
  lightAngleDeg: number;
  lightStrength: number;
  alpha: number;
}

export interface StoppedRef {
  value: boolean;
}

export type LogFn = (...args: unknown[]) => void;
