struct Uniforms {
  // canvasW, canvasH, imageAspect, padding
  canvas0: vec4f,
  // overlayX, overlayY, overlayW, overlayH (pixels, in canvas space)
  overlay0: vec4f,
  // overlayRadiusPx, strokeWidthPx, refractionPx, depthPx
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

fn sample_cover_uv(uv: vec2f, containerAspect: f32, imageAspect: f32) -> vec2f {
  // Fill the whole container (cover). Crops the overflowing axis, no letterbox.
  var outUv = uv;

  if (containerAspect > imageAspect) {
    // Container is wider: crop Y (zoom in vertically).
    let scale = containerAspect / max(0.0001, imageAspect);
    outUv.y = (uv.y - 0.5) / scale + 0.5;
  } else {
    // Container is taller: crop X (zoom in horizontally).
    let scale = imageAspect / max(0.0001, containerAspect);
    outUv.x = (uv.x - 0.5) / scale + 0.5;
  }

  return clamp(outUv, vec2f(0.0), vec2f(1.0));
}

fn backgroundColorAtUv(uv: vec2f) -> vec3f {
  let canvasSize = u.canvas0.xy;
  let containerAspect = canvasSize.x / max(1.0, canvasSize.y);
  let imageAspect = max(0.0001, u.canvas0.z);
  let imgUv = sample_cover_uv(uv, containerAspect, imageAspect);
  return textureSample(leftImage, imgSamp, imgUv).rgb;
}

@fragment
fn fs_background(in: VSOut) -> @location(0) vec4f {
  // Match the DOM/canvas coordinate system: y grows downward.
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(backgroundColorAtUv(uv), 1.0);
}

@fragment
fn fs_overlay(in: VSOut) -> @location(0) vec4f {
  let canvasSize = u.canvas0.xy;
  // Match the DOM/canvas coordinate system: y grows downward.
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  let fragPx = uv * canvasSize;

  // Overlay rectangle in pixel space.
  let r0 = u.overlay0.xy;
  let sz = u.overlay0.zw;
  let center = r0 + sz * 0.5;
  let half = sz * 0.5;
  let pPx = fragPx - center;
  let d = sd_round_rect_px(pPx, half, u.radii0.x);

  let aa = 1.25;
  // Use increasing edges for portability across implementations.
  let fill = 1.0 - smoothstep(-aa, aa, d);

  // Static refraction (no noise): a regular lens-like field.
  // Goal: center ~ unchanged, edges bend in an ordered way (along the SDF normal).
  // Parameters:
  // - u.radii0.z: Refraction (max offset, in pixels at the edge)
  // - u.radii0.w: depthPx (how far the edge distortion penetrates inward)
  let eps = 1.0;
  let ddx = sd_round_rect_px(pPx + vec2f(eps, 0.0), half, u.radii0.x) - sd_round_rect_px(pPx - vec2f(eps, 0.0), half, u.radii0.x);
  let ddy = sd_round_rect_px(pPx + vec2f(0.0, eps), half, u.radii0.x) - sd_round_rect_px(pPx - vec2f(0.0, eps), half, u.radii0.x);
  let grad = vec2f(ddx, ddy);
  let nrm = grad / max(1e-6, length(grad));

  // 0 at/beyond depthPx from the edge, 1 at the edge. This creates a stable center region.
  let distIn = max(0.0, -d);
  let depthPx = max(1.0, u.radii0.w);
  let edge = sat(1.0 - distIn / depthPx);
  let edge2 = edge * edge;

  // Sign: sample slightly "towards the lens center" (convex/magnifying feel).
  let offsetPx = (-nrm) * (u.radii0.z * edge2);
  let uvRefract = clamp(uv + offsetPx / max(vec2f(1.0), canvasSize), vec2f(0.0), vec2f(1.0));

  // Refraction = sample the background at an offset UV (no blur, no animation).
  let refracted = backgroundColorAtUv(uvRefract);

  // Refraction-only debug: no tint, no border, alpha is just the SDF fill.
  // This makes it easier to judge whether refraction itself is working.
  let col = refracted;
  let alpha = fill;

  // Premultiply for blending.
  return vec4f(col * alpha, alpha);
}
