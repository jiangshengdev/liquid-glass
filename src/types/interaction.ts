import type { StoppedRef } from "./common";
import type { GlassState } from "./state";

/** 指针事件绑定所需依赖。 */
export interface PointerHandlersDeps {
  /** 交互画布。 */
  canvas: HTMLCanvasElement;
  /** 玻璃状态对象。 */
  state: GlassState;
  /** 缩放命中阈值。 */
  resizeMargin: number;
  /** 确保画布已按当前尺寸配置。 */
  ensureCanvasConfigured: () => boolean;
  /** 请求一次渲染。 */
  requestRender: () => void;
  /** 更新玻璃 UI 显示状态。 */
  updateGlassUi: (visible: boolean) => void;
  /** 渲染停止标记。 */
  stoppedRef: StoppedRef;
}
