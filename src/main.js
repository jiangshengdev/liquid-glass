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
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
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

  const bgPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vs_fullscreen" },
    fragment: { module, entryPoint: "fs_background", targets: [{ format: presentationFormat }] },
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
      { binding: 1, resource: sampler },
    ],
  });

  let lastW = 0;
  let lastH = 0;
  let lastDpr = 0;
  function configureIfNeeded() {
    const dpr = dprClamped();
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (w === lastW && h === lastH && dpr === lastDpr) return;
    lastW = w;
    lastH = h;
    lastDpr = dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.configure({ device, format: presentationFormat, alphaMode: "premultiplied" });
    log("ctx.configure =", { w, h, dpr, presentationFormat });

    // Centered rounded rect (capsule). Size is based on viewport (CSS px) then converted to device px.
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const overlayWCss = Math.min(cssW * 0.8, 920);
    const overlayHCss = Math.min(cssH * 0.32, 280);
    const overlayW = Math.max(1, Math.round(overlayWCss * dpr));
    const overlayH = Math.max(1, Math.round(overlayHCss * dpr));
    const overlayX = (w - overlayW) * 0.5;
    const overlayY = (h - overlayH) * 0.5;
    const overlayR = overlayH * 0.5;
    const strokeW = 0;
    // Static refraction parameters (device px).
    // Increase these to make the distortion more obvious (still static).
    const refractionPx = 56 * dpr;
    const noiseScale = 3.5;

    // Pack uniforms: 4 vec4 = 16 floats.
    const f = new Float32Array(16);
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
    // radii0: overlayRadiusPx, strokeWidthPx, padding, padding
    f[8] = overlayR;
    f[9] = strokeW;
    // radii0.zw: refractionPx, noiseScale
    f[10] = refractionPx;
    f[11] = noiseScale;
    // overlayColor: rgba
    f[12] = 1.0;
    f[13] = 1.0;
    f[14] = 1.0;
    // Debug: "透明度 = 0"（不叠加任何半透明染色，只看折射本身）。
    // Note: shader currently ignores this alpha for the refraction-only mode.
    f[15] = 0.0;

    queue.writeBuffer(uniformBuffer, 0, f);
  }

  function render() {
    // Guard: some Safari builds may briefly return a zero-sized drawable on resize.
    if (canvas.width <= 1 || canvas.height <= 1) return;
    const encoder = device.createCommandEncoder();
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
    pass.setBindGroup(1, imageBG);

    pass.setPipeline(bgPipeline);
    pass.draw(3);

    pass.setPipeline(overlayPipeline);
    pass.draw(3);

    pass.end();
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
        configureIfNeeded();
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

  window.addEventListener("resize", requestRender);
  requestRender();
}

main().catch((err) => {
  console.error(err);
  showFallback(`main() 未捕获异常：${err?.message || err}`);
});
