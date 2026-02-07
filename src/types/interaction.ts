import type { StoppedRef } from "./common";
import type { GlassState } from "./state";

export interface PointerHandlersDeps {
  canvas: HTMLCanvasElement;
  state: GlassState;
  resizeMargin: number;
  ensureCanvasConfigured: () => boolean;
  requestRender: () => void;
  updateGlassUi: (visible: boolean) => void;
  stoppedRef: StoppedRef;
}
