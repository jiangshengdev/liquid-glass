import { buildRefractionArrows } from "../debug/refraction-mapping";
import {
  createOffscreenTargets,
  type OffscreenTargets,
} from "./offscreen-targets";
import { createPipelines } from "./pipelines";
import { encodeFinalPass, encodeScenePasses } from "./render-passes";
import { packUniforms } from "./uniforms";
import type { Renderer, RendererDeps } from "../types/renderer";

// 每个箭头实例写入 4 个 f32：source.xy + destination.xy。
const REFRACTION_ARROW_STRIDE = 16;
// 箭头采样步长（CSS 像素）：值越小，边缘带箭头越密。
const REFRACTION_ARROW_SPACING = 20;
// 浮点比较容差，避免微小抖动导致重复重建箭头。
const FLOAT_EPSILON = 1e-3;

/** 折射箭头缓存的判等快照。 */
interface RefractionArrowSnapshot {
  /** 玻璃左侧坐标。 */
  left: number;
  /** 玻璃顶部坐标。 */
  top: number;
  /** 玻璃宽度。 */
  width: number;
  /** 玻璃高度。 */
  height: number;
  /** 折射强度。 */
  refraction: number;
  /** 深度衰减比例。 */
  depth: number;
  /** 箭头采样偏移 x。 */
  offsetX: number;
  /** 箭头采样偏移 y。 */
  offsetY: number;
}

/**
 * 判断两份箭头快照是否等价。
 * @param previous 上一次缓存快照。
 * @param next 当前待比较快照。
 * @returns 等价返回 `true`，否则返回 `false`。
 */
function snapshotEquals(
  previous: RefractionArrowSnapshot | null,
  next: RefractionArrowSnapshot,
): boolean {
  if (!previous) return false;

  return (
    Math.abs(previous.left - next.left) < FLOAT_EPSILON &&
    Math.abs(previous.top - next.top) < FLOAT_EPSILON &&
    Math.abs(previous.width - next.width) < FLOAT_EPSILON &&
    Math.abs(previous.height - next.height) < FLOAT_EPSILON &&
    Math.abs(previous.refraction - next.refraction) < FLOAT_EPSILON &&
    Math.abs(previous.depth - next.depth) < FLOAT_EPSILON &&
    Math.abs(previous.offsetX - next.offsetX) < FLOAT_EPSILON &&
    Math.abs(previous.offsetY - next.offsetY) < FLOAT_EPSILON
  );
}

/**
 * 创建渲染器：负责画布配置、uniform 写入、离屏 Pass 编码与提交。
 * @param deps 渲染依赖集合。
 * @returns 渲染器实例。
 */
export function createRenderer({
  device,
  queue,
  canvas,
  canvasContext,
  sampler,
  imageTexture,
  module,
  presentationFormat,
  imageAspect,
  state,
  params,
  devicePixelRatioClamped,
  log,
  updateGlassUi,
  isGlassUiHidden,
}: RendererDeps): Renderer {
  // uniform 缓冲区固定 256 字节，满足 WebGPU 最小对齐要求。
  const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // 折射箭头实例缓冲区：初始预留 256 个实例，按需扩容。
  let refractionArrowCapacity = 256;
  let refractionArrowBuffer = device.createBuffer({
    size: refractionArrowCapacity * REFRACTION_ARROW_STRIDE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // 创建并缓存渲染管线与 bind group。
  let pipelines = createPipelines({
    device,
    module,
    presentationFormat,
    uniformBuffer,
    refractionDebugBuffer: refractionArrowBuffer,
    imageTexture,
    sampler,
  });

  let targets: OffscreenTargets | null = null;
  // 标记离屏场景纹理是否过期。
  let sceneDirty = true;
  // 当前有效的折射箭头实例数量。
  let refractionArrowCount = 0;
  // 标记箭头实例缓冲是否需要重建。
  let refractionArrowsDirty = true;
  // 记录最近一次写入箭头缓冲时的几何与参数快照。
  let refractionArrowSnapshot: RefractionArrowSnapshot | null = null;

  // 6 个 vec4 对应 24 个 float。
  const uniformFloat32Data = new Float32Array(24);

  /**
   * 在箭头实例缓冲被替换后，同步重建依赖该缓冲的 bind group 与管线。
   * @returns 无返回值。
   */
  function recreatePipelines(): void {
    pipelines = createPipelines({
      device,
      module,
      presentationFormat,
      uniformBuffer,
      refractionDebugBuffer: refractionArrowBuffer,
      imageTexture,
      sampler,
    });
  }

  /**
   * 确保箭头实例缓冲容量足够。
   * @param requiredCount 本次需要容纳的实例数量。
   * @returns 无返回值。
   */
  function ensureRefractionArrowCapacity(requiredCount: number): void {
    if (requiredCount <= refractionArrowCapacity) return;

    // 采用翻倍扩容，避免拖拽过程中频繁重建 GPUBuffer。
    refractionArrowCapacity = Math.max(
      requiredCount,
      refractionArrowCapacity * 2,
    );
    refractionArrowBuffer.destroy();
    refractionArrowBuffer = device.createBuffer({
      size: refractionArrowCapacity * REFRACTION_ARROW_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    recreatePipelines();
  }

  /**
   * 根据当前玻璃几何与折射参数，按需更新 GPU 箭头实例缓冲。
   * @returns 无返回值。
   */
  function updateRefractionArrows(): void {
    const nextSnapshot: RefractionArrowSnapshot = {
      left: state.glass.left,
      top: state.glass.top,
      width: state.glass.width,
      height: state.glass.height,
      refraction: params.refraction,
      depth: params.depth,
      offsetX: state.refractionArrowOffset.x,
      offsetY: state.refractionArrowOffset.y,
    };

    // 几何与参数均未变化时，直接复用上次上传的实例数据。
    if (
      !refractionArrowsDirty &&
      snapshotEquals(refractionArrowSnapshot, nextSnapshot)
    ) {
      return;
    }

    // 以“最终显示位置 destination”为基准采样，保证箭头与实际位移场一致。
    const arrows = buildRefractionArrows(
      state.glass,
      params,
      REFRACTION_ARROW_SPACING,
      state.refractionArrowOffset,
    );
    refractionArrowSnapshot = nextSnapshot;
    refractionArrowCount = arrows.length;
    refractionArrowsDirty = false;

    if (refractionArrowCount === 0) return;

    ensureRefractionArrowCapacity(refractionArrowCount);

    // 以像素空间写入 source.xy + destination.xy，供顶点阶段直接读取。
    const arrowData = new Float32Array(refractionArrowCount * 4);
    for (let index = 0; index < refractionArrowCount; index += 1) {
      const arrow = arrows[index];
      const base = index * 4;
      arrowData[base] = arrow.source.x * state.canvas.devicePixelRatio;
      arrowData[base + 1] = arrow.source.y * state.canvas.devicePixelRatio;
      arrowData[base + 2] = arrow.destination.x * state.canvas.devicePixelRatio;
      arrowData[base + 3] = arrow.destination.y * state.canvas.devicePixelRatio;
    }

    queue.writeBuffer(refractionArrowBuffer, 0, arrowData);
  }

  /**
   * 重建离屏纹理与 bind group。
   * @returns 无返回值。
   */
  function recreateOffscreenTargets(): void {
    // 按最新画布尺寸重建离屏纹理。
    targets = createOffscreenTargets({
      device,
      imageBindGroupLayout: pipelines.imageBindGroupLayout,
      sampler,
      width: state.canvas.pixelWidth,
      height: state.canvas.pixelHeight,
      previous: targets,
    });
    // 重建后需重新渲染场景。
    sceneDirty = true;
  }

  /**
   * 同步画布像素尺寸并按需配置 CanvasContext。
   * @returns 画布尺寸或 DPR 是否发生变化。
   */
  function ensureCanvasConfigured(): boolean {
    // 获取当前设备像素比。
    const devicePixelRatio = devicePixelRatioClamped();
    // 读取 CSS 尺寸。
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    // 计算像素尺寸。
    const pixelWidth = Math.max(1, Math.floor(cssWidth * devicePixelRatio));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * devicePixelRatio));

    const changed = state.updateCanvasState({
      pixelWidth,
      pixelHeight,
      devicePixelRatio,
      cssWidth,
      cssHeight,
    });

    if (changed) {
      // 更新画布像素尺寸。
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      // 重新配置画布上下文。
      canvasContext.configure({
        device,
        format: presentationFormat,
        alphaMode: "premultiplied",
      });
      // 输出本次配置信息。
      log("canvasContext.configure =", {
        width: pixelWidth,
        height: pixelHeight,
        devicePixelRatio,
        presentationFormat,
      });
      // DPR 改变会影响像素空间箭头端点，必须重写实例缓冲。
      refractionArrowsDirty = true;
    }

    // 同步玻璃 UI 的可见与位置。
    updateGlassUi(!isGlassUiHidden());

    if (changed || !targets) recreateOffscreenTargets();
    return changed;
  }

  /**
   * 将当前场景参数打包并写入 GPU uniform 缓冲区。
   * @returns 无返回值。
   */
  function writeUniforms(): void {
    // 将状态与参数打包到 uniform 数组。
    packUniforms(
      {
        canvasWidth: state.canvas.pixelWidth,
        canvasHeight: state.canvas.pixelHeight,
        imageAspect,
        devicePixelRatio: state.canvas.devicePixelRatio,
        overlayLeft: state.glass.left,
        overlayTop: state.glass.top,
        overlayWidth: state.glass.width,
        overlayHeight: state.glass.height,
        params,
      },
      uniformFloat32Data,
    );
    // 写入 GPU uniform 缓冲区。
    queue.writeBuffer(uniformBuffer, 0, uniformFloat32Data);
  }

  /**
   * 执行一帧渲染命令编码与提交。
   * @returns 无返回值。
   */
  function render(): void {
    // 保护：Safari 某些版本在 resize 瞬间可能给出 0 尺寸 drawable。
    if (canvas.width <= 1 || canvas.height <= 1 || !targets) return;

    // 在编码前确保箭头实例缓冲与当前玻璃状态一致。
    updateRefractionArrows();

    // 创建命令编码器。
    const encoder = device.createCommandEncoder();

    // 仅在场景脏时重算离屏场景与高斯模糊。
    if (sceneDirty) {
      encodeScenePasses({ encoder, targets, pipelines });
      sceneDirty = false;
    }

    // 最终通道：先绘制场景，再叠加玻璃层与折射箭头。
    encodeFinalPass({
      encoder,
      canvasContext,
      targets,
      pipelines,
      refractionArrowCount,
    });

    // 提交命令到 GPU 队列。
    queue.submit([encoder.finish()]);
  }

  return {
    ensureCanvasConfigured,
    writeUniforms,
    render,
    setSceneDirty(value: boolean) {
      // 外部标记场景是否脏；玻璃变化时也需要刷新箭头实例。
      sceneDirty = !!value;
      refractionArrowsDirty = true;
    },
  };
}
