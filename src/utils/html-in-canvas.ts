interface HtmlInCanvasSupportOptions {
  /** 目标 canvas 元素。 */
  canvas: HTMLCanvasElement;
  /** WebGPU 提交队列。 */
  queue: GPUQueue;
}

/**
 * 检测当前运行时是否具备 HTML-in-Canvas + WebGPU 所需实验 API。
 * @param options 检测输入。
 * @returns 具备所需能力时返回 `true`。
 */
export function hasHtmlInCanvasWebGpuSupport({
  canvas,
  queue,
}: HtmlInCanvasSupportOptions): boolean {
  return (
    "onpaint" in canvas &&
    typeof canvas.getElementTransform === "function" &&
    typeof queue.copyElementImageToTexture === "function"
  );
}
