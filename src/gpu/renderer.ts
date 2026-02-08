import {
  createOffscreenTargets,
  type OffscreenTargets,
} from "./offscreen-targets";
import { createPipelines } from "./pipelines";
import { encodeFinalPass, encodeScenePasses } from "./render-passes";
import { packUniforms } from "./uniforms";
import type { Renderer, RendererDeps } from "../types/renderer";

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

  const pipelines = createPipelines({
    device,
    module,
    presentationFormat,
    uniformBuffer,
    imageTexture,
    sampler,
  });

  let targets: OffscreenTargets | null = null;
  let sceneDirty = true;

  // 6 个 vec4 对应 24 个 float。
  const uniformFloat32Data = new Float32Array(24);

  /**
   * 重建离屏纹理与 bind group。
   * @returns 无返回值。
   */
  function recreateOffscreenTargets(): void {
    targets = createOffscreenTargets({
      device,
      imageBindGroupLayout: pipelines.imageBindGroupLayout,
      sampler,
      width: state.canvas.pixelWidth,
      height: state.canvas.pixelHeight,
      previous: targets,
    });
    sceneDirty = true;
  }

  /**
   * 同步画布像素尺寸并按需配置 CanvasContext。
   * @returns 画布尺寸或 DPR 是否发生变化。
   */
  function ensureCanvasConfigured(): boolean {
    const devicePixelRatio = devicePixelRatioClamped();
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
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
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvasContext.configure({
        device,
        format: presentationFormat,
        alphaMode: "premultiplied",
      });
      log("canvasContext.configure =", {
        width: pixelWidth,
        height: pixelHeight,
        devicePixelRatio,
        presentationFormat,
      });
    }

    updateGlassUi(!isGlassUiHidden());

    if (changed || !targets) recreateOffscreenTargets();
    return changed;
  }

  /**
   * 将当前场景参数打包并写入 GPU uniform 缓冲区。
   * @returns 无返回值。
   */
  function writeUniforms(): void {
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
    queue.writeBuffer(uniformBuffer, 0, uniformFloat32Data);
  }

  /**
   * 执行一帧渲染命令编码与提交。
   * @returns 无返回值。
   */
  function render(): void {
    // 保护：Safari 某些版本在 resize 瞬间可能给出 0 尺寸 drawable。
    if (canvas.width <= 1 || canvas.height <= 1 || !targets) return;

    const encoder = device.createCommandEncoder();

    // 仅在场景脏时重算离屏场景与高斯模糊。
    if (sceneDirty) {
      encodeScenePasses({ encoder, targets, pipelines });
      sceneDirty = false;
    }

    // 最终通道：先绘制场景，再叠加玻璃层。
    encodeFinalPass({ encoder, canvasContext, targets, pipelines });

    queue.submit([encoder.finish()]);
  }

  return {
    ensureCanvasConfigured,
    writeUniforms,
    render,
    setSceneDirty(value: boolean) {
      sceneDirty = !!value;
    },
  };
}
