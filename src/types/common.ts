/** 拖拽模式类型。 */
export type DragMode = "move" | "resize";

/** 缩放命中的边集合。 */
export interface ResizeEdges {
  /** 是否命中左边。 */
  left: boolean;
  /** 是否命中右边。 */
  right: boolean;
  /** 是否命中上边。 */
  top: boolean;
  /** 是否命中下边。 */
  bottom: boolean;
}

/** 玻璃矩形几何信息（CSS 像素）。 */
export interface GlassRect {
  /** 左上角 x。 */
  left: number;
  /** 左上角 y。 */
  top: number;
  /** 宽度。 */
  width: number;
  /** 高度。 */
  height: number;
}

/** 玻璃效果参数集合。 */
export interface GlassParams {
  /** 折射强度。 */
  refraction: number;
  /** 深度衰减比例。 */
  depth: number;
  /** 色散强度。 */
  dispersion: number;
  /** 磨砂强度。 */
  frost: number;
  /** 展散强度。 */
  splay: number;
  /** 光照角度（度）。 */
  lightAngleDeg: number;
  /** 光照强度。 */
  lightStrength: number;
  /** 玻璃整体透明度。 */
  alpha: number;
}

/** 运行停止标记引用。 */
export interface StoppedRef {
  /** 是否已停止。 */
  value: boolean;
}

/** 日志函数签名。 */
export type LogFn = (...args: unknown[]) => void;
