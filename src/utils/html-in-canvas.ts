interface HtmlInCanvasSupportOptions {
  /** 目标 canvas 元素。 */
  canvas: HTMLCanvasElement;
  /** WebGPU 提交队列。 */
  queue: GPUQueue;
}

interface SyncHtmlInCanvasElementTransformOptions {
  /** 目标 canvas 元素。 */
  canvas: HTMLCanvasElement;
  /** 需要同步命中位置的 HTML-in-Canvas 元素。 */
  element: HTMLElement;
  /** 元素在 canvas 网格中的绘制矩阵。 */
  drawTransform: DOMMatrix;
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

/**
 * 将 HTML-in-Canvas 元素的 DOM 命中位置同步到 canvas 绘制位置。
 * @param options 同步输入。
 * @returns 成功写入 CSS transform 时返回 `true`。
 */
export function syncHtmlInCanvasElementTransform({
  canvas,
  element,
  drawTransform,
}: SyncHtmlInCanvasElementTransformOptions): boolean {
  const computedTransform = canvas.getElementTransform(element, drawTransform);
  if (!computedTransform) return false;

  element.style.transform = computedTransform.toString();
  return true;
}
