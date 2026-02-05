struct Uniforms {
  // canvasW, canvasH, imageAspect, padding
  canvas0: vec4f,
  // overlayX, overlayY, overlayW, overlayH (pixels, in canvas space)
  overlay0: vec4f,
  // overlayRadiusPx, strokeWidthPx, refractionPx, depthPx
  radii0: vec4f,
  // frostPx, lightAngleRad, lightStrength, padding (angle: clockwise from up, in radians)
  params0: vec4f,
  // dispersion, splay, reserved, reserved
  params1: vec4f,
  // overlay RGBA (non-premultiplied)
  overlayColor: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

// Bind group 1 is shared across all passes.
// - Pass: scene       -> tex0 = source image
// - Pass: blur/present-> tex0 = input texture (sceneTex / blurTex)
// - Pass: overlay     -> tex0 = sharp sceneTex, tex1 = blurred sceneTex
@group(1) @binding(0) var tex0: texture_2d<f32>;
@group(1) @binding(1) var tex1: texture_2d<f32>;
@group(1) @binding(2) var samp0: sampler;

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

fn imageColorCoverAtUv(uv: vec2f) -> vec3f {
  let canvasSize = u.canvas0.xy;
  let containerAspect = canvasSize.x / max(1.0, canvasSize.y);
  let imageAspect = max(0.0001, u.canvas0.z);
  let imgUv = sample_cover_uv(uv, containerAspect, imageAspect);
  return textureSampleLevel(tex0, samp0, imgUv, 0.0).rgb;
}

@fragment
fn fs_scene(in: VSOut) -> @location(0) vec4f {
  // Match the DOM/canvas coordinate system: y grows downward.
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(imageColorCoverAtUv(uv), 1.0);
}

@fragment
fn fs_present(in: VSOut) -> @location(0) vec4f {
  // Present pass draws an already-cover-mapped scene texture 1:1 to the screen.
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(textureSampleLevel(tex0, samp0, uv, 0.0).rgb, 1.0);
}

fn gauss(x: f32, sigma: f32) -> f32 {
  let s = max(0.0001, sigma);
  let inv = 1.0 / (s * s);
  return exp(-0.5 * x * x * inv);
}

fn blur1d(uv: vec2f, dirPx: vec2f) -> vec3f {
  // Separable Gaussian blur.
  let canvasSize = max(vec2f(1.0), u.canvas0.xy);
  let texel = 1.0 / canvasSize;
  let frostPx = clamp(u.params0.x, 0.0, 12.0);
  let radius = i32(round(frostPx));
  let sigma = frostPx * 0.5;

  var sum = vec3f(0.0);
  var wsum = 0.0;

  // Uniform control flow (radius is uniform).
  for (var i: i32 = -radius; i <= radius; i = i + 1) {
    let fi = f32(i);
    let w = gauss(fi, sigma);
    let uvo = clamp(uv + (dirPx * fi) * texel, vec2f(0.0), vec2f(1.0));
    sum = sum + textureSampleLevel(tex0, samp0, uvo, 0.0).rgb * w;
    wsum = wsum + w;
  }

  return sum / max(1e-6, wsum);
}

@fragment
fn fs_blur_h(in: VSOut) -> @location(0) vec4f {
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(blur1d(uv, vec2f(1.0, 0.0)), 1.0);
}

@fragment
fn fs_blur_v(in: VSOut) -> @location(0) vec4f {
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(blur1d(uv, vec2f(0.0, 1.0)), 1.0);
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

  // Refraction = sample the background at an offset UV (no animation).
  // Frost = Gaussian blur amount (pre-blurred in a separate pass).
  let sharp = textureSampleLevel(tex0, samp0, uvRefract, 0.0).rgb;
  let blurred = textureSampleLevel(tex1, samp0, uvRefract, 0.0).rgb;
  let frostMix = sat(u.params0.x / 4.0);
  let refracted = mix(sharp, blurred, frostMix);

  // Directional light: a simple bevel-like highlight/shadow near the edge.
  // Default: angle = -45deg (top-left), strength = 0.8.
  // Angle convention: clockwise from "up" in DOM/canvas space (y grows downward).
  let ang = u.params0.y;
  let lightStrength = sat(u.params0.z);
  let lightDir = normalize(vec2f(sin(ang), -cos(ang))); // -45deg => (-0.707,-0.707) = top-left
  let ndotl = dot(nrm, lightDir);
  let hl = sat(ndotl);
  let sh = sat(-ndotl);
  // Highlight region thickness. Smaller => thinner highlight.
  let rimW = max(1.5, u.radii0.x * 0.07);
  let rim = sat(1.0 - distIn / rimW);
  let rimLine = sat(1.0 - distIn / max(0.75, rimW * 0.22));

  var col = refracted;
  // Highlight: mix towards white (stronger right at the edge).
  let hlAmt = sat((0.10 * rim + 1.00 * rimLine) * hl * (lightStrength * 1.35));
  col = mix(col, vec3f(1.0), hlAmt);
  // Shadow: multiplicative darkening (so it doesn't look like a black stroke).
  let shAmt = sat(0.35 * rim * sh * lightStrength);
  col = col * (1.0 - shAmt);

  // Refraction-only debug: no tint, no border, alpha is just the SDF fill.
  // This makes it easier to judge whether refraction itself is working.
  let alpha = fill * sat(u.overlayColor.a);

  // Premultiply for blending.
  return vec4f(col * alpha, alpha);
}
