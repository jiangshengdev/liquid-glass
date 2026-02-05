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

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn value_noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));

  let x1 = mix(a, b, u.x);
  let x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

fn fbm(p: vec2f) -> f32 {
  // Static FBM: fixed octaves, unrolled for compatibility (Safari/WebKit).
  var v = 0.0;
  var a = 0.5;
  var q = p;

  v += a * value_noise(q);
  q = q * 2.0 + vec2f(17.0, 9.0);
  a *= 0.5;

  v += a * value_noise(q);
  q = q * 2.0 + vec2f(17.0, 9.0);
  a *= 0.5;

  v += a * value_noise(q);
  q = q * 2.0 + vec2f(17.0, 9.0);
  a *= 0.5;

  v += a * value_noise(q);
  return v;
}

@fragment
fn fs_background(in: VSOut) -> @location(0) vec4f {
  return vec4f(backgroundColorAtUv(in.uv), 1.0);
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

  // Static refraction: offset the background sampling UV once, using procedural noise.
  // Parameters:
  // - u.radii0.z: refraction strength (pixels)
  // - u.radii0.w: noise scale (dimensionless, in overlay-local UV space)
  let localUv = (fragPx - r0) / max(sz, vec2f(0.0001));
  let localCentered = localUv - vec2f(0.5);
  // Make distortion a bit stronger near the long edges (lens-like).
  let aspect = sz.x / max(1.0, sz.y);
  let r = length(localCentered * vec2f(aspect, 1.0));
  let lens = sat((r - 0.05) / 0.55);

  let p = localUv * u.radii0.w;
  // Expand fbm from roughly [0..1) to [-1..1) to make the refraction clearly visible.
  let n = vec2f(fbm(p), fbm(p + vec2f(7.13, 31.7))) * 2.0 - vec2f(1.0);
  let strength = mix(0.20, 1.0, lens * lens);
  let offsetUv = n * (u.radii0.z / max(vec2f(1.0), canvasSize)) * strength;
  let uvRefract = clamp(uv + offsetUv, vec2f(0.0), vec2f(1.0));

  // Refraction = sample the background at an offset UV (no blur, no animation).
  let refracted = backgroundColorAtUv(uvRefract);

  // Refraction-only debug: no tint, no border, alpha is just the SDF fill.
  // This makes it easier to judge whether refraction itself is working.
  let col = refracted;
  let alpha = fill;

  // Premultiply for blending.
  return vec4f(col * alpha, alpha);
}
