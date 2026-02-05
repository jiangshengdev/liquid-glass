import wgsl from "./shaders.wgsl?raw";

function showFallback(reason) {
  if (reason) console.warn("[webgpu:fallback]", reason);
  const el = document.getElementById("fallback");
  if (el) {
    el.hidden = false;
    if (reason) {
      const card = el.querySelector(".fallback-card");
      if (card && !card.querySelector("#fallback-debug")) {
        const pre = document.createElement("pre");
        pre.id = "fallback-debug";
        pre.style.margin = "12px 0 0";
        pre.style.whiteSpace = "pre-wrap";
        pre.style.wordBreak = "break-word";
        pre.style.color = "rgba(255,255,255,0.75)";
        pre.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        pre.textContent = String(reason);
        card.appendChild(pre);
      }
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function dprClamped() {
  return clamp(window.devicePixelRatio || 1, 1, 2);
}

async function loadBitmap(url) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return await createImageBitmap(img);
}

async function main() {
  const log = (...args) => console.log("[webgpu]", ...args);
  log("href =", location.href);
  log("isSecureContext =", window.isSecureContext);
  log("userAgent =", navigator.userAgent);
  log("navigator.gpu =", "gpu" in navigator ? navigator.gpu : null);

  if (!("gpu" in navigator)) {
    showFallback("navigator.gpu 不存在：通常是未开启 WebGPU 实验特性，或不是安全上下文（需 https:// 或 http://localhost）。");
    return;
  }

  let adapter;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (e) {
    showFallback(`requestAdapter() 抛错：${e?.message || e}`);
    return;
  }
  if (!adapter) {
    showFallback("requestAdapter() 返回 null：通常是 WebGPU 未开启/被策略禁用/不在安全上下文/或系统不支持该实现。");
    return;
  }
  log("adapter =", adapter);
  // These are often useful when debugging Safari/WebKit behavior.
  try {
    log("adapter.features =", [...adapter.features.values()]);
  } catch {
    // ignore
  }

  let device;
  try {
    device = await adapter.requestDevice();
  } catch (e) {
    showFallback(`requestDevice() 抛错：${e?.message || e}`);
    return;
  }
  device.lost.then((info) => {
    console.error("[webgpu] device lost:", info);
  });
  const queue = device.queue;

  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("c"));
  const ctx = /** @type {GPUCanvasContext} */ (canvas.getContext("webgpu"));
  const glassUi = /** @type {HTMLDivElement | null} */ (document.getElementById("glass-ui"));
  if (!ctx) {
    showFallback("canvas.getContext('webgpu') 返回 null：可能是 WebGPU 未启用，或页面不是安全上下文。");
    return;
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat
    ? navigator.gpu.getPreferredCanvasFormat()
    : /** @type {GPUTextureFormat} */ ("bgra8unorm");
  log("presentationFormat =", presentationFormat);

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const OFFSCREEN_FORMAT = /** @type {GPUTextureFormat} */ ("rgba8unorm");

  // Load the left-side background image (from previous step / downloaded asset).
  const imgUrl = new URL("./assets/left-image.png", import.meta.url).href;
  log("loading image =", imgUrl);
  const bitmap = await loadBitmap(imgUrl);
  log("image bitmap =", { width: bitmap.width, height: bitmap.height });
  const imageAspect = bitmap.width / Math.max(1, bitmap.height);
  const imgTex = device.createTexture({
    size: { width: bitmap.width, height: bitmap.height },
    format: "rgba8unorm",
    // Some implementations require RenderAttachment for external image copies
    // (even if the texture is only sampled later).
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  queue.copyExternalImageToTexture({ source: bitmap }, { texture: imgTex }, { width: bitmap.width, height: bitmap.height });

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

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [uniformBGL, imageBGL] });
  const module = device.createShaderModule({ code: wgsl });
  if (typeof module.getCompilationInfo === "function") {
    try {
      const info = await module.getCompilationInfo();
      if (info.messages?.length) {
        let hasError = false;
        console.groupCollapsed?.("[webgpu] shader compilation info");
        for (const m of info.messages) {
          const where = `line ${m.lineNum}:${m.linePos}`;
          const msg = `${m.type.toUpperCase()} ${where} ${m.message}`;
          if (m.type === "error") {
            hasError = true;
            console.error(msg);
          }
          else if (m.type === "warning") console.warn(msg);
          else console.log(msg);
        }
        console.groupEnd?.();
        if (hasError) {
          showFallback("WGSL 编译失败：请查看控制台中的 shader compilation info。");
          return;
        }
      } else {
        log("shader compilation info: (no messages)");
      }
    } catch (e) {
      console.warn("[webgpu] getCompilationInfo() failed:", e?.message || e);
    }
  }

  // Surface any validation errors (Safari sometimes doesn't show these clearly otherwise).
  device.pushErrorScope("validation");
  device.pushErrorScope("out-of-memory");

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

  // Pop error scopes after pipeline creation.
  {
    const oom = await device.popErrorScope();
    const val = await device.popErrorScope();
    if (oom) console.error("[webgpu] OOM error:", oom);
    if (val) console.error("[webgpu] Validation error:", val);
    if (oom || val) {
      const msg = String((val || oom)?.message || val || oom);
      showFallback(`GPU 校验失败：${msg}`);
      return;
    }
  }

  const uniformBG = device.createBindGroup({
    layout: uniformBGL,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const imageBG = device.createBindGroup({
    layout: imageBGL,
    entries: [
      { binding: 0, resource: imgTex.createView() },
      { binding: 1, resource: imgTex.createView() },
      { binding: 2, resource: sampler },
    ],
  });

  // --- Parameters (official Figma: Refraction / depth / dispersion / frost / splay) ---
  // This step only uses Refraction + depth. Others are placeholders (kept at 0).
  const PARAMS = {
    refraction: 56, // CSS px
    depth: 0.35, // 0..1, relative to capsule radius
    dispersion: 0,
    frost: 4,
    splay: 0,
    // Light (directional). Angle in degrees, default -45° = top-left.
    lightAngleDeg: -45,
    lightStrength: 0.8, // 0..1
    // Constant alpha for easy tweaking; 1.0 means the glass fully replaces the background under it.
    alpha: 1.0,
  };

  // --- Interaction constants (CSS px) ---
  const MIN_W = 240;
  const MIN_H = 96;
  const RESIZE_MARGIN = 18;

  // Persistent glass rect (CSS px) so resizing the window doesn't reset placement.
  const glass = { xCss: 0, yCss: 0, wCss: 0, hCss: 0 };
  let glassInited = false;

  let canvasPxW = 0;
  let canvasPxH = 0;
  let canvasDpr = 1;
  let canvasCssW = 0;
  let canvasCssH = 0;

  // Offscreen render targets (scene + Gaussian blur).
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
    try { sceneTex?.destroy(); } catch { /* ignore */ }
    try { blurTexA?.destroy(); } catch { /* ignore */ }
    try { blurTexB?.destroy(); } catch { /* ignore */ }

    const size = { width: canvasPxW, height: canvasPxH };
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

  function initGlassDefault(cssW, cssH) {
    const w = Math.min(cssW * 0.8, 920);
    const h = Math.min(cssH * 0.32, 280);
    glass.wCss = Math.max(MIN_W, Math.min(cssW, w));
    glass.hCss = Math.max(MIN_H, Math.min(cssH, h));
    // Keep a horizontal capsule by default.
    glass.wCss = Math.max(glass.wCss, glass.hCss);
    glass.xCss = (cssW - glass.wCss) * 0.5;
    glass.yCss = (cssH - glass.hCss) * 0.5;
    glassInited = true;
  }

  function clampGlass(cssW, cssH) {
    glass.wCss = clamp(glass.wCss, MIN_W, Math.max(MIN_W, cssW));
    glass.hCss = clamp(glass.hCss, MIN_H, Math.max(MIN_H, cssH));
    // Capsule constraint: radius = height/2 => height should not exceed width.
    glass.hCss = Math.min(glass.hCss, glass.wCss);
    glass.xCss = clamp(glass.xCss, 0, Math.max(0, cssW - glass.wCss));
    glass.yCss = clamp(glass.yCss, 0, Math.max(0, cssH - glass.hCss));
  }

  function updateGlassUi(visible) {
    if (!glassUi) return;
    if (typeof visible === "boolean") glassUi.hidden = !visible;
    if (glassUi.hidden) return;
    glassUi.style.left = `${glass.xCss}px`;
    glassUi.style.top = `${glass.yCss}px`;
    glassUi.style.width = `${glass.wCss}px`;
    glassUi.style.height = `${glass.hCss}px`;
  }

  function ensureCanvasConfigured() {
    const dpr = dprClamped();
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));

    const changed = w !== canvasPxW || h !== canvasPxH || dpr !== canvasDpr;
    canvasPxW = w;
    canvasPxH = h;
    canvasDpr = dpr;
    canvasCssW = cssW;
    canvasCssH = cssH;

    if (changed) {
      canvas.width = w;
      canvas.height = h;
      ctx.configure({ device, format: presentationFormat, alphaMode: "premultiplied" });
      log("ctx.configure =", { w, h, dpr, presentationFormat });
    }

    if (!glassInited) initGlassDefault(cssW, cssH);
    clampGlass(cssW, cssH);
    updateGlassUi(!glassUi?.hidden);

    if (changed || !sceneTex) recreateOffscreenTargets();
    return changed;
  }

  const uniformsF32 = new Float32Array(24);
  function writeUniforms() {
    const dpr = canvasDpr;
    const w = canvasPxW;
    const h = canvasPxH;

    const overlayX = glass.xCss * dpr;
    const overlayY = glass.yCss * dpr;
    const overlayW = glass.wCss * dpr;
    const overlayH = glass.hCss * dpr;
    const overlayR = overlayH * 0.5;
    const strokeW = 0;

    const refractionPx = PARAMS.refraction * dpr;
    const depthPx = overlayR * PARAMS.depth;

    const frostPx = PARAMS.frost * dpr;
    const lightAngleRad = (PARAMS.lightAngleDeg * Math.PI) / 180;
    const lightStrength = PARAMS.lightStrength;

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
    f[16] = PARAMS.dispersion;
    f[17] = PARAMS.splay;
    f[18] = 0;
    f[19] = 0;
    // overlayColor: rgb + alpha (non-premultiplied)
    f[20] = 1.0;
    f[21] = 1.0;
    f[22] = 1.0;
    f[23] = PARAMS.alpha;

    queue.writeBuffer(uniformBuffer, 0, f);
  }

  function sdRoundRect(px, py, halfW, halfH, r) {
    const qx = Math.abs(px) - (halfW - r);
    const qy = Math.abs(py) - (halfH - r);
    const mx = Math.max(qx, 0);
    const my = Math.max(qy, 0);
    return Math.hypot(mx, my) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function pointerPosCss(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function hitTestGlass(px, py) {
    const cx = glass.xCss + glass.wCss * 0.5;
    const cy = glass.yCss + glass.hCss * 0.5;
    const halfW = glass.wCss * 0.5;
    const halfH = glass.hCss * 0.5;
    const rad = glass.hCss * 0.5;
    const d = sdRoundRect(px - cx, py - cy, halfW, halfH, rad);
    const inside = d <= 0;

    // IMPORTANT:
    // - Move should respect the *rounded* shape (avoid dragging from transparent corners).
    // - Resize/handles should behave like Figma/Photoshop: use the AABB (square selection box),
    //   otherwise corner handles become unreachable because the rounded-rect SDF is far outside.
    const x1 = glass.xCss;
    const y1 = glass.yCss;
    const x2 = glass.xCss + glass.wCss;
    const y2 = glass.yCss + glass.hCss;
    const dx = Math.max(x1 - px, 0, px - x2);
    const dy = Math.max(y1 - py, 0, py - y2);
    const distRect = Math.hypot(dx, dy);
    const active = distRect <= RESIZE_MARGIN;

    const dl = px - glass.xCss;
    const dr = glass.xCss + glass.wCss - px;
    const dt = py - glass.yCss;
    const db = glass.yCss + glass.hCss - py;
    const adl = Math.abs(dl);
    const adr = Math.abs(dr);
    const adt = Math.abs(dt);
    const adb = Math.abs(db);

    let nearL = adl < RESIZE_MARGIN;
    let nearR = adr < RESIZE_MARGIN;
    if (nearL && nearR) {
      nearL = adl <= adr;
      nearR = !nearL;
    }

    let nearT = adt < RESIZE_MARGIN;
    let nearB = adb < RESIZE_MARGIN;
    if (nearT && nearB) {
      nearT = adt <= adb;
      nearB = !nearT;
    }

    const edges = active ? { l: nearL, r: nearR, t: nearT, b: nearB } : { l: false, r: false, t: false, b: false };
    const wantsResize = active && (nearL || nearR || nearT || nearB);
    const mode = wantsResize ? "resize" : inside ? "move" : null;
    return { d, inside, mode, edges };
  }

  function cursorForHit(mode, edges) {
    if (mode === "resize") {
      const { l, r, t, b } = edges;
      if ((l && t) || (r && b)) return "nwse-resize";
      if ((r && t) || (l && b)) return "nesw-resize";
      if (l || r) return "ew-resize";
      if (t || b) return "ns-resize";
    }
    if (mode === "move") return "move";
    return "";
  }

  const drag = {
    active: false,
    mode: /** @type {"move"|"resize"} */ ("move"),
    pointerId: -1,
    startPx: 0,
    startPy: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    l: false,
    r: false,
    t: false,
    b: false,
  };

  function startDrag(mode, pointerId, px, py, edges) {
    drag.active = true;
    drag.mode = mode;
    drag.pointerId = pointerId;
    drag.startPx = px;
    drag.startPy = py;
    drag.startX = glass.xCss;
    drag.startY = glass.yCss;
    drag.startW = glass.wCss;
    drag.startH = glass.hCss;
    drag.l = !!edges?.l;
    drag.r = !!edges?.r;
    drag.t = !!edges?.t;
    drag.b = !!edges?.b;
  }

  function endDrag(pointerId) {
    if (!drag.active || pointerId !== drag.pointerId) return;
    drag.active = false;
    drag.pointerId = -1;
  }

  function applyMove(px, py) {
    const dx = px - drag.startPx;
    const dy = py - drag.startPy;
    glass.xCss = drag.startX + dx;
    glass.yCss = drag.startY + dy;
    clampGlass(canvasCssW, canvasCssH);
  }

  function applyResize(px, py) {
    const dx = px - drag.startPx;
    const dy = py - drag.startPy;

    let x1 = drag.startX;
    let y1 = drag.startY;
    let x2 = drag.startX + drag.startW;
    let y2 = drag.startY + drag.startH;

    if (drag.l) x1 += dx;
    if (drag.r) x2 += dx;
    if (drag.t) y1 += dy;
    if (drag.b) y2 += dy;

    // Min size.
    if (x2 - x1 < MIN_W) {
      if (drag.l && !drag.r) x1 = x2 - MIN_W;
      else x2 = x1 + MIN_W;
    }
    if (y2 - y1 < MIN_H) {
      if (drag.t && !drag.b) y1 = y2 - MIN_H;
      else y2 = y1 + MIN_H;
    }

    // Clamp to canvas bounds (prefer clamping the dragged edge).
    if (drag.l && !drag.r) {
      x1 = clamp(x1, 0, x2 - MIN_W);
    } else if (drag.r && !drag.l) {
      x2 = clamp(x2, x1 + MIN_W, canvasCssW);
    } else {
      const w = x2 - x1;
      x1 = clamp(x1, 0, Math.max(0, canvasCssW - w));
      x2 = x1 + w;
    }

    if (drag.t && !drag.b) {
      y1 = clamp(y1, 0, y2 - MIN_H);
    } else if (drag.b && !drag.t) {
      y2 = clamp(y2, y1 + MIN_H, canvasCssH);
    } else {
      const h = y2 - y1;
      y1 = clamp(y1, 0, Math.max(0, canvasCssH - h));
      y2 = y1 + h;
    }

    // Capsule constraint: keep height <= width (so radius = height/2 stays valid).
    let w = x2 - x1;
    let h = y2 - y1;
    if (h > w) {
      const newH = w;
      if (drag.t && !drag.b) y1 = y2 - newH;
      else if (drag.b && !drag.t) y2 = y1 + newH;
      else {
        const cy = (y1 + y2) * 0.5;
        y1 = cy - newH * 0.5;
        y2 = y1 + newH;
      }
      if (y1 < 0) {
        y1 = 0;
        y2 = newH;
      }
      if (y2 > canvasCssH) {
        y2 = canvasCssH;
        y1 = y2 - newH;
      }
      h = y2 - y1;
    }

    glass.xCss = x1;
    glass.yCss = y1;
    glass.wCss = x2 - x1;
    glass.hCss = h;
    clampGlass(canvasCssW, canvasCssH);
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

  // Render on demand (prevents log/error spam if something goes wrong).
  let rafPending = false;
  let stopped = false;
  const requestRender = () => {
    if (stopped || rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      try {
        ensureCanvasConfigured();
        writeUniforms();
        render();
      } catch (e) {
        stopped = true;
        console.error("[webgpu] render failed:", e?.message || e);
        showFallback(`渲染失败：${e?.message || e}`);
      }
    });
  };

  // If Safari fires a GPU error, stop further renders to avoid spamming the console.
  device.onuncapturederror = (ev) => {
    stopped = true;
    console.error("[webgpu] uncapturederror:", ev.error?.message || ev.error);
    showFallback(`GPU 错误：${ev.error?.message || ev.error}`);
  };

  // --- Pointer interactions: drag to move; drag edges/corners to resize. ---
  const onPointerDown = (ev) => {
    if (stopped) return;
    if (!ev.isPrimary || ev.button !== 0) return;
    ensureCanvasConfigured();

    const p = pointerPosCss(ev);
    const hit = hitTestGlass(p.x, p.y);
    // Ignore clicks too far from the glass / selection box.
    if (!hit.mode) return;

    canvas.setPointerCapture(ev.pointerId);
    startDrag(hit.mode, ev.pointerId, p.x, p.y, hit.edges);
    updateGlassUi(true);
    canvas.style.cursor = cursorForHit(hit.mode, hit.edges) || canvas.style.cursor;
    ev.preventDefault();
    requestRender();
  };

  const onPointerMove = (ev) => {
    if (stopped) return;
    const p = pointerPosCss(ev);
    ensureCanvasConfigured();

    if (!drag.active) {
      const hit = hitTestGlass(p.x, p.y);
      const c = cursorForHit(hit.mode, hit.edges);
      canvas.style.cursor = c || "default";
      updateGlassUi(!!hit.mode);
      return;
    }

    if (ev.pointerId !== drag.pointerId) return;
    if (drag.mode === "move") applyMove(p.x, p.y);
    else applyResize(p.x, p.y);

    ev.preventDefault();
    requestRender();
  };

  const onPointerUp = (ev) => {
    try {
      if (canvas.hasPointerCapture?.(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
    endDrag(ev.pointerId);
    requestRender();
  };

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("lostpointercapture", (ev) => {
    endDrag(ev.pointerId);
    requestRender();
  });
  canvas.addEventListener("pointerleave", () => {
    if (drag.active) return;
    canvas.style.cursor = "default";
    updateGlassUi(false);
  });

  window.addEventListener("resize", requestRender);
  requestRender();
}

main().catch((err) => {
  console.error(err);
  showFallback(`main() 未捕获异常：${err?.message || err}`);
});
