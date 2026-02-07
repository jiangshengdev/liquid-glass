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
  ctx,
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

  const uniformsF32 = new Float32Array(24);

  function recreateOffscreenTargets(): void {
    targets = createOffscreenTargets({
      device,
      imageBGL: pipelines.imageBGL,
      sampler,
      width: state.canvas.pxW,
      height: state.canvas.pxH,
      previous: targets,
    });
    sceneDirty = true;
  }

  function ensureCanvasConfigured(): boolean {
    const dpr = dprClamped();
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));

    const changed = state.updateCanvasState({ pxW, pxH, dpr, cssW, cssH });

    if (changed) {
      canvas.width = pxW;
      canvas.height = pxH;
      ctx.configure({
        device,
        format: presentationFormat,
        alphaMode: "premultiplied",
      });
      log("ctx.configure =", { w: pxW, h: pxH, dpr, presentationFormat });
    }

    updateGlassUi(!isGlassUiHidden());

    if (changed || !targets) recreateOffscreenTargets();
    return changed;
  }

  function writeUniforms(): void {
    packUniforms(
      {
        canvasPxW: state.canvas.pxW,
        canvasPxH: state.canvas.pxH,
        imageAspect,
        dpr: state.canvas.dpr,
        overlayXCss: state.glass.xCss,
        overlayYCss: state.glass.yCss,
        overlayWCss: state.glass.wCss,
        overlayHCss: state.glass.hCss,
        params,
      },
      uniformsF32,
    );
    queue.writeBuffer(uniformBuffer, 0, uniformsF32);
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
    encodeFinalPass({ encoder, ctx, targets, pipelines });

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
