struct Uniforms {
  // canvasW, canvasH, imageAspect, padding
  canvas0: vec4f,
  // overlayX, overlayY, overlayW, overlayH (pixels, in canvas space)
  overlay0: vec4f,
  // overlayRadiusPx, strokeWidthPx, padding, padding
  radii0: vec4f,
  // overlay RGBA (non-premultiplied)
  overlayColor: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@group(1) @binding(0) var leftImage: texture_2d<f32>;
@group(1) @binding(1) var imgSamp: sampler;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vi: u32) -> VSOut {
  // Full-screen triangle (no vertex buffer).
  // Avoid array indexing here for maximum WGSL implementation compatibility (Safari).
  var p: vec2f;
  var t: vec2f;
  if (vi == 0u) {
    p = vec2f(-1.0, -1.0);
    t = vec2f(0.0, 0.0);
  } else if (vi == 1u) {
    p = vec2f(3.0, -1.0);
    t = vec2f(2.0, 0.0);
  } else {
    p = vec2f(-1.0, 3.0);
    t = vec2f(0.0, 2.0);
  }
  var out: VSOut;
  out.pos = vec4f(p, 0.0, 1.0);
  out.uv = t;
  return out;
}

fn sat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

fn sd_round_rect_px(p: vec2f, half: vec2f, r: f32) -> f32 {
  // p, half, r are all in the same coordinate space.
  let q = abs(p) - (half - vec2f(r));
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

fn sample_contain_uv(uv: vec2f, containerAspect: f32, imageAspect: f32) -> vec3f {
  // Fit the whole image without cropping (contain). Returns (u, v, mask).
  // mask=1 when inside the fitted image rect, 0 for letterboxed area.
  var outUv = uv;
  var mask = 1.0;

  if (containerAspect > imageAspect) {
    // Container is wider than the image: pad X.
    let wNorm = imageAspect / containerAspect;
    let pad = (1.0 - wNorm) * 0.5;
    mask = step(pad, uv.x) * step(uv.x, 1.0 - pad);
    outUv.x = (uv.x - pad) / max(0.0001, wNorm);
  } else {
    // Container is taller than the image: pad Y.
    let hNorm = containerAspect / imageAspect;
    let pad = (1.0 - hNorm) * 0.5;
    mask = step(pad, uv.y) * step(uv.y, 1.0 - pad);
    outUv.y = (uv.y - pad) / max(0.0001, hNorm);
  }

  outUv = clamp(outUv, vec2f(0.0), vec2f(1.0));
  return vec3f(outUv, mask);
}

@fragment
fn fs_background(in: VSOut) -> @location(0) vec4f {
  let canvasSize = u.canvas0.xy;
  // NOTE: With the full-screen triangle setup used here, `in.uv` is already 0..1
  // over the visible viewport. Multiplying by 0.5 would only sample 1/4 of the image.
  let uv = in.uv; // 0..1

  // Show the full image (contain, no cropping).
  let containerAspect = canvasSize.x / max(1.0, canvasSize.y);
  let imageAspect = max(0.0001, u.canvas0.z);
  let s = sample_contain_uv(uv, containerAspect, imageAspect);
  var col = textureSample(leftImage, imgSamp, s.xy).rgb;
  // Letterbox: dark gray, not pure black.
  col = mix(vec3f(0.05, 0.05, 0.07), col, s.z);
  return vec4f(col, 1.0);
}

@fragment
fn fs_overlay(in: VSOut) -> @location(0) vec4f {
  let canvasSize = u.canvas0.xy;
  let uv = in.uv;
  let fragPx = uv * canvasSize;

  // Overlay rectangle in pixel space.
  let r0 = u.overlay0.xy;
  let sz = u.overlay0.zw;
  let center = r0 + sz * 0.5;
  let half = sz * 0.5;
  let d = sd_round_rect_px(fragPx - center, half, u.radii0.x);

  let aa = 1.25;
  // Use increasing edges for portability across implementations.
  let fill = 1.0 - smoothstep(-aa, aa, d);
  if (fill <= 0.0) {
    return vec4f(0.0);
  }

  // Simple fill + subtle stroke (still "no effects", but makes it readable).
  let strokeW = max(0.0, u.radii0.y);
  let stroke = 1.0 - smoothstep(-aa, aa, abs(d) - strokeW);

  let base = u.overlayColor.rgb;
  let a = u.overlayColor.a;
  var col = base;
  var alpha = a * fill;
  // stroke uses higher alpha
  alpha = max(alpha, (a + 0.18) * stroke);
  col = col;

  // Premultiply for blending.
  return vec4f(col * alpha, alpha);
}
