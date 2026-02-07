struct Uniforms {
  // canvasWidth, canvasHeight, imageAspect, padding
  canvasMetrics: vec4f,
  // overlayLeft, overlayTop, overlayWidth, overlayHeight (pixels, in canvas space)
  overlayBounds: vec4f,
  // overlayRadius, strokeWidth, refractionAmount, depthAmount
  opticalParams: vec4f,
  // frostAmount, lightAngleRad, lightStrength, padding (angle: clockwise from up, in radians)
  lightingParams: vec4f,
  // dispersion, splay, reserved, reserved
  dispersionParams: vec4f,
  // overlay RGBA (non-premultiplied)
  overlayColor: vec4f,
}

@group(0) @binding(0) var<uniform> sceneUniforms: Uniforms;

// Bind group 1 is shared across all passes.
// - Pass: scene        -> primaryTexture = source image
// - Pass: blur/present -> primaryTexture = input texture (scene texture / blur texture)
// - Pass: overlay      -> primaryTexture = sharp scene texture, secondaryTexture = blurred scene texture
@group(1) @binding(0) var primaryTexture: texture_2d<f32>;
@group(1) @binding(1) var secondaryTexture: texture_2d<f32>;
@group(1) @binding(2) var linearSampler: sampler;

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) textureCoordinates: vec2f,
};

@vertex
fn vertex_fullscreen(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Full-screen triangle (no vertex buffer).
  // Avoid array indexing here for maximum WGSL implementation compatibility (Safari).
  var clipCoordinates: vec2f;
  var textureCoordinates: vec2f;
  if (vertexIndex == 0u) {
    clipCoordinates = vec2f(-1.0, -1.0);
    textureCoordinates = vec2f(0.0, 0.0);
  } else if (vertexIndex == 1u) {
    clipCoordinates = vec2f(3.0, -1.0);
    textureCoordinates = vec2f(2.0, 0.0);
  } else {
    clipCoordinates = vec2f(-1.0, 3.0);
    textureCoordinates = vec2f(0.0, 2.0);
  }

  var vertexOutput: VertexOutput;
  vertexOutput.clipPosition = vec4f(clipCoordinates, 0.0, 1.0);
  vertexOutput.textureCoordinates = textureCoordinates;
  return vertexOutput;
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn signed_distance_rounded_rect(
  samplePosition: vec2f,
  halfSize: vec2f,
  radius: f32,
) -> f32 {
  // samplePosition, halfSize, radius are all in the same coordinate space.
  let distanceToCorner = abs(samplePosition) - (halfSize - vec2f(radius));
  return (
    length(max(distanceToCorner, vec2f(0.0))) +
    min(max(distanceToCorner.x, distanceToCorner.y), 0.0) -
    radius
  );
}

fn compute_cover_texture_coordinates(
  textureCoordinates: vec2f,
  containerAspect: f32,
  imageAspect: f32,
) -> vec2f {
  // Fill the whole container (cover). Crops the overflowing axis, no letterbox.
  var resultCoordinates = textureCoordinates;

  if (containerAspect > imageAspect) {
    // Container is wider: crop Y (zoom in vertically).
    let scale = containerAspect / max(0.0001, imageAspect);
    resultCoordinates.y = (textureCoordinates.y - 0.5) / scale + 0.5;
  } else {
    // Container is taller: crop X (zoom in horizontally).
    let scale = imageAspect / max(0.0001, containerAspect);
    resultCoordinates.x = (textureCoordinates.x - 0.5) / scale + 0.5;
  }

  return clamp(resultCoordinates, vec2f(0.0), vec2f(1.0));
}

fn sample_cover_color(textureCoordinates: vec2f) -> vec3f {
  let canvasSize = sceneUniforms.canvasMetrics.xy;
  let containerAspect = canvasSize.x / max(1.0, canvasSize.y);
  let imageAspect = max(0.0001, sceneUniforms.canvasMetrics.z);
  let imageCoordinates = compute_cover_texture_coordinates(
    textureCoordinates,
    containerAspect,
    imageAspect,
  );
  return textureSampleLevel(primaryTexture, linearSampler, imageCoordinates, 0.0).rgb;
}

@fragment
fn fragment_scene(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // Match the DOM/canvas coordinate system: y grows downward.
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  return vec4f(sample_cover_color(textureCoordinates), 1.0);
}

@fragment
fn fragment_present(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // Present pass draws an already-cover-mapped scene texture 1:1 to the screen.
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  return vec4f(
    textureSampleLevel(primaryTexture, linearSampler, textureCoordinates, 0.0).rgb,
    1.0,
  );
}

fn gaussian_sample_weight(sampleOffset: f32, sigma: f32) -> f32 {
  let sigmaSafe = max(0.0001, sigma);
  let varianceInverse = 1.0 / (sigmaSafe * sigmaSafe);
  return exp(-0.5 * sampleOffset * sampleOffset * varianceInverse);
}

fn blur_single_axis(textureCoordinates: vec2f, blurDirection: vec2f) -> vec3f {
  // Separable Gaussian blur.
  let canvasSize = max(vec2f(1.0), sceneUniforms.canvasMetrics.xy);
  let texelSize = 1.0 / canvasSize;
  let frostAmount = clamp(sceneUniforms.lightingParams.x, 0.0, 12.0);
  let sampleRadius = i32(round(frostAmount));
  let sigma = frostAmount * 0.5;

  var colorSum = vec3f(0.0);
  var weightSum = 0.0;

  // Uniform control flow (sampleRadius is uniform).
  for (
    var sampleIndex: i32 = -sampleRadius;
    sampleIndex <= sampleRadius;
    sampleIndex = sampleIndex + 1
  ) {
    let sampleOffset = f32(sampleIndex);
    let sampleWeight = gaussian_sample_weight(sampleOffset, sigma);
    let offsetCoordinates = clamp(
      textureCoordinates + (blurDirection * sampleOffset) * texelSize,
      vec2f(0.0),
      vec2f(1.0),
    );
    colorSum =
      colorSum +
      textureSampleLevel(primaryTexture, linearSampler, offsetCoordinates, 0.0).rgb * sampleWeight;
    weightSum = weightSum + sampleWeight;
  }

  return colorSum / max(1e-6, weightSum);
}

@fragment
fn fragment_blur_horizontal(vertexOutput: VertexOutput) -> @location(0) vec4f {
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  return vec4f(blur_single_axis(textureCoordinates, vec2f(1.0, 0.0)), 1.0);
}

@fragment
fn fragment_blur_vertical(vertexOutput: VertexOutput) -> @location(0) vec4f {
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  return vec4f(blur_single_axis(textureCoordinates, vec2f(0.0, 1.0)), 1.0);
}

@fragment
fn fragment_overlay(vertexOutput: VertexOutput) -> @location(0) vec4f {
  let canvasSize = sceneUniforms.canvasMetrics.xy;
  // Match the DOM/canvas coordinate system: y grows downward.
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  let fragmentPosition = textureCoordinates * canvasSize;

  // Overlay rectangle in pixel space.
  let overlayOrigin = sceneUniforms.overlayBounds.xy;
  let overlaySize = sceneUniforms.overlayBounds.zw;
  let overlayCenter = overlayOrigin + overlaySize * 0.5;
  let overlayHalfSize = overlaySize * 0.5;
  let pointInOverlay = fragmentPosition - overlayCenter;
  let signedDistance = signed_distance_rounded_rect(
    pointInOverlay,
    overlayHalfSize,
    sceneUniforms.opticalParams.x,
  );

  let antialiasWidth = 1.25;
  // Use increasing edges for portability across implementations.
  let fillFactor =
    1.0 - smoothstep(-antialiasWidth, antialiasWidth, signedDistance);

  // Static refraction (no noise): a regular lens-like field.
  // Goal: center ~ unchanged, edges bend in an ordered way (along the SDF normal).
  // Parameters:
  // - sceneUniforms.opticalParams.z: refraction amount (max offset, in pixels at the edge)
  // - sceneUniforms.opticalParams.w: depth amount (how far the edge distortion penetrates inward)
  let derivativeStep = 1.0;
  let gradientLeft =
    signed_distance_rounded_rect(
      pointInOverlay + vec2f(derivativeStep, 0.0),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      pointInOverlay - vec2f(derivativeStep, 0.0),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  let gradientTop =
    signed_distance_rounded_rect(
      pointInOverlay + vec2f(0.0, derivativeStep),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    ) -
    signed_distance_rounded_rect(
      pointInOverlay - vec2f(0.0, derivativeStep),
      overlayHalfSize,
      sceneUniforms.opticalParams.x,
    );
  let surfaceGradient = vec2f(gradientLeft, gradientTop);
  let surfaceNormal = surfaceGradient / max(1e-6, length(surfaceGradient));

  // 0 at/beyond depth amount from the edge, 1 at the edge. This creates a stable center region.
  let distanceInside = max(0.0, -signedDistance);
  let depthAmount = max(1.0, sceneUniforms.opticalParams.w);
  let edgeFactor = saturate(1.0 - distanceInside / depthAmount);
  let edgeFactorSquared = edgeFactor * edgeFactor;

  // Sign: sample slightly "towards the lens center" (convex/magnifying feel).
  let refractionOffset =
    (-surfaceNormal) * (sceneUniforms.opticalParams.z * edgeFactorSquared);
  let refractedCoordinates = clamp(
    textureCoordinates + refractionOffset / max(vec2f(1.0), canvasSize),
    vec2f(0.0),
    vec2f(1.0),
  );

  // Refraction = sample the background at an offset UV (no animation).
  // Frost = Gaussian blur amount (pre-blurred in a separate pass).
  let sharpColor = textureSampleLevel(
    primaryTexture,
    linearSampler,
    refractedCoordinates,
    0.0,
  ).rgb;
  let blurredColor = textureSampleLevel(
    secondaryTexture,
    linearSampler,
    refractedCoordinates,
    0.0,
  ).rgb;
  let frostBlendFactor = saturate(sceneUniforms.lightingParams.x / 4.0);
  let refractedColor = mix(sharpColor, blurredColor, frostBlendFactor);

  // Directional light: a simple bevel-like highlight/shadow near the edge.
  // Default: angle = -45deg (top-left), strength = 0.8.
  // Angle convention: clockwise from "up" in DOM/canvas space (y grows downward).
  let lightAngle = sceneUniforms.lightingParams.y;
  let lightStrength = saturate(sceneUniforms.lightingParams.z);
  let lightDirection = normalize(vec2f(sin(lightAngle), -cos(lightAngle))); // -45deg => (-0.707,-0.707) = top-left
  let normalDotLight = dot(surfaceNormal, lightDirection);
  let primaryHighlight = saturate(normalDotLight);
  let secondaryHighlight = saturate(-normalDotLight);
  // Highlight width: smaller values produce a thinner rim.
  let rimWidth = max(1.5, sceneUniforms.opticalParams.x * 0.07);
  let rimFactor = saturate(1.0 - distanceInside / rimWidth);
  let rimLineFactor =
    saturate(1.0 - distanceInside / max(0.75, rimWidth * 0.22));

  var compositeColor = refractedColor;
  // Dual highlight style: stronger top-left, weaker bottom-right.
  let primaryHighlightAmount = saturate(
    (0.10 * rimFactor + 1.00 * rimLineFactor) *
      primaryHighlight *
      (lightStrength * 1.65),
  );
  let secondaryHighlightAmount = saturate(
    (0.06 * rimFactor + 0.80 * rimLineFactor) *
      secondaryHighlight *
      (lightStrength * 0.95),
  );
  compositeColor = mix(compositeColor, vec3f(1.0), primaryHighlightAmount);
  compositeColor = mix(compositeColor, vec3f(1.0), secondaryHighlightAmount);

  // Refraction-only debug: no tint, no border, alpha is just the SDF fill.
  // This makes it easier to judge whether refraction itself is working.
  let alpha = fillFactor * saturate(sceneUniforms.overlayColor.a);

  // Premultiply for blending.
  return vec4f(compositeColor * alpha, alpha);
}
