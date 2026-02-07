// @ts-nocheck
import { OFFSCREEN_FORMAT } from "../config/params";

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
}) {
  const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBGL = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
  });
  const imageBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
    ],
  });

  const uniformBG = device.createBindGroup({
    layout: uniformBGL,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const imageBG = device.createBindGroup({
    layout: imageBGL,
    entries: [
      { binding: 0, resource: imageTex.createView() },
      { binding: 1, resource: imageTex.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [uniformBGL, imageBGL] });
  const scenePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: { module, entryPoint: "fs_scene", targets: [{ format: OFFSCREEN_FORMAT }] },
    primitive: { topology: "triangle-list" },
  });

  const blurHPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: { module, entryPoint: "fs_blur_h", targets: [{ format: OFFSCREEN_FORMAT }] },
    primitive: { topology: "triangle-list" },
  });

  const blurVPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: { module, entryPoint: "fs_blur_v", targets: [{ format: OFFSCREEN_FORMAT }] },
    primitive: { topology: "triangle-list" },
  });

  const presentPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: { module, entryPoint: "fs_present", targets: [{ format: presentationFormat }] },
    primitive: { topology: "triangle-list" },
  });

  const overlayPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: {
      module,
      entryPoint: "fs_overlay",
      targets: [
        {
          format: presentationFormat,
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });

  /** @type {GPUTexture | null} */
  let sceneTex = null;
  /** @type {GPUTexture | null} */
  let blurTexA = null;
  /** @type {GPUTexture | null} */
  let blurTexB = null;
  /** @type {GPUBindGroup | null} */
  let blurHBG = null;
  /** @type {GPUBindGroup | null} */
  let blurVBG = null;
  /** @type {GPUBindGroup | null} */
  let presentBG = null;
  /** @type {GPUBindGroup | null} */
  let overlayBG = null;
  let sceneDirty = true;

  const uniformsF32 = new Float32Array(24);

  const makeImageBG = (texA, texB) =>
    device.createBindGroup({
      layout: imageBGL,
      entries: [
        { binding: 0, resource: texA.createView() },
        { binding: 1, resource: texB.createView() },
        { binding: 2, resource: sampler },
      ],
    });

  function recreateOffscreenTargets() {
    // Destroy old textures to avoid leaking GPU memory on resize.
    try {
      sceneTex?.destroy();
    } catch {
      // ignore
    }
    try {
      blurTexA?.destroy();
    } catch {
      // ignore
    }
    try {
      blurTexB?.destroy();
    } catch {
      // ignore
    }

    const size = { width: state.canvas.pxW, height: state.canvas.pxH };
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

    sceneTex = device.createTexture({ size, format: OFFSCREEN_FORMAT, usage });
    blurTexA = device.createTexture({ size, format: OFFSCREEN_FORMAT, usage });
    blurTexB = device.createTexture({ size, format: OFFSCREEN_FORMAT, usage });

    blurHBG = makeImageBG(sceneTex, sceneTex);
    blurVBG = makeImageBG(blurTexA, blurTexA);
    presentBG = makeImageBG(sceneTex, sceneTex);
    overlayBG = makeImageBG(sceneTex, blurTexB);
    sceneDirty = true;
  }

  function ensureCanvasConfigured() {
    const dpr = dprClamped();
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));

    const changed = state.updateCanvasState({ pxW, pxH, dpr, cssW, cssH });

    if (changed) {
      canvas.width = pxW;
      canvas.height = pxH;
      ctx.configure({ device, format: presentationFormat, alphaMode: "premultiplied" });
      log("ctx.configure =", { w: pxW, h: pxH, dpr, presentationFormat });
    }

    updateGlassUi(!isGlassUiHidden());

    if (changed || !sceneTex) recreateOffscreenTargets();
    return changed;
  }

  function writeUniforms() {
    const dpr = state.canvas.dpr;
    const w = state.canvas.pxW;
    const h = state.canvas.pxH;

    const overlayX = state.glass.xCss * dpr;
    const overlayY = state.glass.yCss * dpr;
    const overlayW = state.glass.wCss * dpr;
    const overlayH = state.glass.hCss * dpr;
    const overlayR = overlayH * 0.5;
    const strokeW = 0;

    const refractionPx = params.refraction * dpr;
    const depthPx = overlayR * params.depth;

    const frostPx = params.frost * dpr;
    const lightAngleRad = (params.lightAngleDeg * Math.PI) / 180;
    const lightStrength = params.lightStrength;

    // Pack uniforms: 6 vec4 = 24 floats.
    const f = uniformsF32;
    // canvas0: canvasW, canvasH, imageAspect, padding
    f[0] = w;
    f[1] = h;
    f[2] = imageAspect;
    f[3] = 0;
    // overlay0: x,y,w,h (pixels)
    f[4] = overlayX;
    f[5] = overlayY;
    f[6] = overlayW;
    f[7] = overlayH;
    // radii0: overlayRadiusPx, strokeWidthPx, refractionPx, depthPx
    f[8] = overlayR;
    f[9] = strokeW;
    f[10] = refractionPx;
    f[11] = depthPx;
    // params0: frostPx, lightAngleRad, lightStrength, padding
    f[12] = frostPx;
    f[13] = lightAngleRad;
    f[14] = lightStrength;
    f[15] = 0;
    // params1: dispersion, splay, reserved, reserved
    f[16] = params.dispersion;
    f[17] = params.splay;
    f[18] = 0;
    f[19] = 0;
    // overlayColor: rgb + alpha (non-premultiplied)
    f[20] = 1.0;
    f[21] = 1.0;
    f[22] = 1.0;
    f[23] = params.alpha;

    queue.writeBuffer(uniformBuffer, 0, f);
  }

  function render() {
    // Guard: some Safari builds may briefly return a zero-sized drawable on resize.
    if (canvas.width <= 1 || canvas.height <= 1) return;
    if (!sceneTex || !blurTexA || !blurTexB || !blurHBG || !blurVBG || !presentBG || !overlayBG) return;

    const encoder = device.createCommandEncoder();

    // (Re)build the offscreen scene + Gaussian blur only when needed.
    if (sceneDirty) {
      // Pass 1: render cover-mapped image into sceneTex.
      {
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: sceneTex.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
        pass.setBindGroup(0, uniformBG);
        pass.setBindGroup(1, imageBG);
        pass.setPipeline(scenePipeline);
        pass.draw(3);
        pass.end();
      }

      // Pass 2: horizontal blur -> blurTexA.
      {
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: blurTexA.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
        pass.setBindGroup(0, uniformBG);
        pass.setBindGroup(1, blurHBG);
        pass.setPipeline(blurHPipeline);
        pass.draw(3);
        pass.end();
      }

      // Pass 3: vertical blur -> blurTexB.
      {
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: blurTexB.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
        pass.setBindGroup(0, uniformBG);
        pass.setBindGroup(1, blurVBG);
        pass.setPipeline(blurVPipeline);
        pass.draw(3);
        pass.end();
      }

      sceneDirty = false;
    }

    // Final pass: present scene + overlay glass.
    {
      const view = ctx.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: 0.05, g: 0.05, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      pass.setBindGroup(0, uniformBG);

      pass.setBindGroup(1, presentBG);
      pass.setPipeline(presentPipeline);
      pass.draw(3);

      pass.setBindGroup(1, overlayBG);
      pass.setPipeline(overlayPipeline);
      pass.draw(3);

      pass.end();
    }

    queue.submit([encoder.finish()]);
  }

  return {
    ensureCanvasConfigured,
    writeUniforms,
    render,
    recreateOffscreenTargets,
    setSceneDirty(value) {
      sceneDirty = !!value;
    },
  };
}
