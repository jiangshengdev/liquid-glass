export type DragMode = "move" | "resize";

export interface ResizeEdges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export interface GlassRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
