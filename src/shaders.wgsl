struct Uniforms {
  // canvasWidth, canvasHeight, imageAspect, padding
  canvas0: vec4f,
  // overlayLeft, overlayTop, overlayWidth, overlayHeight (pixels, in canvas space)
  overlay0: vec4f,
  // overlayRadius, strokeWidth, refractionAmount, depthAmount
  radii0: vec4f,
  // frostAmount, lightAngleRad, lightStrength, padding (angle: clockwise from up, in radians)
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

fn saturate(value: f32) -> f32 { return clamp(value, 0.0, 1.0); }

fn sd_round_rect(samplePosition: vec2f, halfSize: vec2f, radius: f32) -> f32 {
  // samplePosition, halfSize, radius are all in the same coordinate space.
  let distanceToCorner = abs(samplePosition) - (halfSize - vec2f(radius));
  return (
    length(max(distanceToCorner, vec2f(0.0))) +
    min(max(distanceToCorner.x, distanceToCorner.y), 0.0) -
    radius
  );
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

fn gauss(offset: f32, sigma: f32) -> f32 {
  let s = max(0.0001, sigma);
  let inv = 1.0 / (s * s);
  return exp(-0.5 * offset * offset * inv);
}

fn blur1d(uv: vec2f, direction: vec2f) -> vec3f {
  // Separable Gaussian blur.
  let canvasSize = max(vec2f(1.0), u.canvas0.xy);
  let texel = 1.0 / canvasSize;
  let frostAmount = clamp(u.params0.x, 0.0, 12.0);
  let radius = i32(round(frostAmount));
  let sigma = frostAmount * 0.5;

  var sum = vec3f(0.0);
  var wsum = 0.0;

  // Uniform control flow (radius is uniform).
  for (var i: i32 = -radius; i <= radius; i = i + 1) {
    let fi = f32(i);
    let w = gauss(fi, sigma);
    let offsetUv = clamp(uv + (direction * fi) * texel, vec2f(0.0), vec2f(1.0));
    sum = sum + textureSampleLevel(tex0, samp0, offsetUv, 0.0).rgb * w;
    wsum = wsum + w;
  }

  return sum / max(1e-6, wsum);
}

@fragment
fn fs_blur_horizontal(in: VSOut) -> @location(0) vec4f {
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(blur1d(uv, vec2f(1.0, 0.0)), 1.0);
}

@fragment
fn fs_blur_vertical(in: VSOut) -> @location(0) vec4f {
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  return vec4f(blur1d(uv, vec2f(0.0, 1.0)), 1.0);
}

@fragment
fn fs_overlay(in: VSOut) -> @location(0) vec4f {
  let canvasSize = u.canvas0.xy;
  // Match the DOM/canvas coordinate system: y grows downward.
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  let fragmentPosition = uv * canvasSize;

  // Overlay rectangle in pixel space.
  let overlayOrigin = u.overlay0.xy;
  let overlaySize = u.overlay0.zw;
  let overlayCenter = overlayOrigin + overlaySize * 0.5;
  let overlayHalfSize = overlaySize * 0.5;
  let pointInOverlay = fragmentPosition - overlayCenter;
  let signedDistance = sd_round_rect(pointInOverlay, overlayHalfSize, u.radii0.x);

  let antialiasWidth = 1.25;
  // Use increasing edges for portability across implementations.
  let fill = 1.0 - smoothstep(-antialiasWidth, antialiasWidth, signedDistance);

  // Static refraction (no noise): a regular lens-like field.
  // Goal: center ~ unchanged, edges bend in an ordered way (along the SDF normal).
  // Parameters:
  // - u.radii0.z: Refraction (max offset, in pixels at the edge)
  // - u.radii0.w: depth amount (how far the edge distortion penetrates inward)
  let derivativeStep = 1.0;
  let derivativeLeft = sd_round_rect(pointInOverlay + vec2f(derivativeStep, 0.0), overlayHalfSize, u.radii0.x) - sd_round_rect(pointInOverlay - vec2f(derivativeStep, 0.0), overlayHalfSize, u.radii0.x);
  let derivativeTop = sd_round_rect(pointInOverlay + vec2f(0.0, derivativeStep), overlayHalfSize, u.radii0.x) - sd_round_rect(pointInOverlay - vec2f(0.0, derivativeStep), overlayHalfSize, u.radii0.x);
  let gradient = vec2f(derivativeLeft, derivativeTop);
  let normalVector = gradient / max(1e-6, length(gradient));

  // 0 at/beyond depth amount from the edge, 1 at the edge. This creates a stable center region.
  let distanceInside = max(0.0, -signedDistance);
  let depthAmount = max(1.0, u.radii0.w);
  let edge = saturate(1.0 - distanceInside / depthAmount);
  let edge2 = edge * edge;

  // Sign: sample slightly "towards the lens center" (convex/magnifying feel).
  let offsetAmount = (-normalVector) * (u.radii0.z * edge2);
  let uvRefract = clamp(
    uv + offsetAmount / max(vec2f(1.0), canvasSize),
    vec2f(0.0),
    vec2f(1.0),
  );

  // Refraction = sample the background at an offset UV (no animation).
  // Frost = Gaussian blur amount (pre-blurred in a separate pass).
  let sharp = textureSampleLevel(tex0, samp0, uvRefract, 0.0).rgb;
  let blurred = textureSampleLevel(tex1, samp0, uvRefract, 0.0).rgb;
  let frostMix = saturate(u.params0.x / 4.0);
  let refracted = mix(sharp, blurred, frostMix);

  // Directional light: a simple bevel-like highlight/shadow near the edge.
  // Default: angle = -45deg (top-left), strength = 0.8.
  // Angle convention: clockwise from "up" in DOM/canvas space (y grows downward).
  let lightAngle = u.params0.y;
  let lightStrength = saturate(u.params0.z);
  let lightDir = normalize(vec2f(sin(lightAngle), -cos(lightAngle))); // -45deg => (-0.707,-0.707) = top-left
  let normalDotLight = dot(normalVector, lightDir);
  let primaryHighlight = saturate(normalDotLight);
  let secondaryHighlight = saturate(-normalDotLight);
  // 高光区域粗细（越小越细）。
  let rimWidth = max(1.5, u.radii0.x * 0.07);
  let rim = saturate(1.0 - distanceInside / rimWidth);
  let rimLine = saturate(1.0 - distanceInside / max(0.75, rimWidth * 0.22));

  var col = refracted;
  // macOS Tahoe 风格“双高光”（强调玻璃感）：两侧都是高光而不是阴影。
  // 左上更强、右下更弱。
  let primaryHighlightAmount = saturate(
    (0.10 * rim + 1.00 * rimLine) * primaryHighlight * (lightStrength * 1.65),
  );
  let secondaryHighlightAmount = saturate(
    (0.06 * rim + 0.80 * rimLine) * secondaryHighlight * (lightStrength * 0.95),
  );
  col = mix(col, vec3f(1.0), primaryHighlightAmount);
  col = mix(col, vec3f(1.0), secondaryHighlightAmount);

  // Refraction-only debug: no tint, no border, alpha is just the SDF fill.
  // This makes it easier to judge whether refraction itself is working.
  let alpha = fill * saturate(u.overlayColor.a);

  // Premultiply for blending.
  return vec4f(col * alpha, alpha);
}
