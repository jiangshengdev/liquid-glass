import {
  createOffscreenTargets,
  type OffscreenTargets,
} from "./offscreenTargets";
import { createPipelines } from "./pipelines";
import { encodeFinalPass, encodeScenePasses } from "./renderPasses";
import { packUniforms } from "./uniforms";
import type { Renderer, RendererDeps } from "../types/renderer";

export function createRenderer({
  device,
  queue,
  canvas,
  canvasContext,
  sampler,
  imageTex,
  module,
  presentationFormat,
  imageAspect,
  state,
  params,
  dprClamped,
  log,
  updateGlassUi,
  isGlassUiHidden,
}: RendererDeps): Renderer {
  const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipelines = createPipelines({
    device,
    module,
    presentationFormat,
    uniformBuffer,
    imageTex,
    sampler,
  });

  let targets: OffscreenTargets | null = null;
  let sceneDirty = true;

  const uniformFloat32Data = new Float32Array(24);

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

  function ensureCanvasConfigured(): boolean {
    const dpr = dprClamped();
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));

    const changed = state.updateCanvasState({
      pixelWidth,
      pixelHeight,
      dpr,
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
        w: pixelWidth,
        h: pixelHeight,
        dpr,
        presentationFormat,
      });
    }

    updateGlassUi(!isGlassUiHidden());

    if (changed || !targets) recreateOffscreenTargets();
    return changed;
  }

  function writeUniforms(): void {
    packUniforms(
      {
        canvasPxW: state.canvas.pixelWidth,
        canvasPxH: state.canvas.pixelHeight,
        imageAspect,
        dpr: state.canvas.dpr,
        overlayXCss: state.glass.xCss,
        overlayYCss: state.glass.yCss,
        overlayWCss: state.glass.wCss,
        overlayHCss: state.glass.hCss,
        params,
      },
      uniformFloat32Data,
    );
    queue.writeBuffer(uniformBuffer, 0, uniformFloat32Data);
  }

  function render(): void {
    // Guard: some Safari builds may briefly return a zero-sized drawable on resize.
    if (canvas.width <= 1 || canvas.height <= 1 || !targets) return;

    const encoder = device.createCommandEncoder();

    // (Re)build the offscreen scene + Gaussian blur only when needed.
    if (sceneDirty) {
      encodeScenePasses({ encoder, targets, pipelines });
      sceneDirty = false;
    }

    // Final pass: present scene + overlay glass.
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
