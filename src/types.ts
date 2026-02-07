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

export interface CanvasState {
  pxW: number;
  pxH: number;
  dpr: number;
  cssW: number;
  cssH: number;
}

export interface DragState extends ResizeEdges {
  active: boolean;
  mode: DragMode;
  pointerId: number;
  startPx: number;
  startPy: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export interface GlassState {
  glass: GlassRect;
  drag: DragState;
  canvas: CanvasState;
  clampGlass(cssW: number, cssH: number): void;
  updateCanvasState(next: CanvasState): boolean;
  startDrag(mode: DragMode, pointerId: number, px: number, py: number, edges?: Partial<ResizeEdges>): void;
  endDrag(pointerId: number): void;
  applyMove(px: number, py: number): void;
  applyResize(px: number, py: number): void;
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

export interface Renderer {
  ensureCanvasConfigured(): boolean;
  writeUniforms(): void;
  render(): void;
  recreateOffscreenTargets(): void;
  setSceneDirty(value: boolean): void;
}

export interface RendererDeps {
  device: GPUDevice;
  queue: GPUQueue;
  canvas: HTMLCanvasElement;
  ctx: GPUCanvasContext;
  sampler: GPUSampler;
  imageTex: GPUTexture;
  module: GPUShaderModule;
  presentationFormat: GPUTextureFormat;
  imageAspect: number;
  state: GlassState;
  params: GlassParams;
  dprClamped: () => number;
  log: LogFn;
  updateGlassUi: (visible?: boolean) => void;
  isGlassUiHidden: () => boolean;
}

export interface PointerHandlersDeps {
  canvas: HTMLCanvasElement;
  state: GlassState;
  resizeMargin: number;
  ensureCanvasConfigured: () => boolean;
  requestRender: () => void;
  updateGlassUi: (visible: boolean) => void;
  stoppedRef: StoppedRef;
}
