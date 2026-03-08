//! 折射箭头调试通道：使用 GPU 实例化绘制位移箭头。

// 每个实例包含：原始像素位置 source 与最终显示位置 destination。
struct RefractionArrowInstance {
  source: vec2f,
  destination: vec2f,
}

// group(1)：复用调试专用 bind group，仅在顶点阶段读取实例数据。
@group(1) @binding(0) var<storage, read> refractionArrowInstances: array<RefractionArrowInstance>;

// 调试箭头顶点阶段输出：仅需位置与统一颜色。
struct RefractionDebugVertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) color: vec4f,
}

/// 将画布像素坐标转换到裁剪空间。
fn canvas_to_clip(canvasPoint: vec2f) -> vec2f {
  let canvasSize = max(vec2f(1.0), sceneUniforms.canvasMetrics.xy);
  let normalized = canvasPoint / canvasSize;
  return vec2f(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

/// 返回第 `vertexIndex` 个模板顶点。
/// 0~5：箭杆矩形，两组三角形。
/// 6~8：箭头头三角形。
fn select_refraction_debug_vertex(vertexIndex: u32) -> vec2f {
  if (vertexIndex == 0u) {
    return vec2f(0.0, -0.5);
  } else if (vertexIndex == 1u) {
    return vec2f(0.0, 0.5);
  } else if (vertexIndex == 2u) {
    return vec2f(1.0, -0.5);
  } else if (vertexIndex == 3u) {
    return vec2f(1.0, -0.5);
  } else if (vertexIndex == 4u) {
    return vec2f(0.0, 0.5);
  } else if (vertexIndex == 5u) {
    return vec2f(1.0, 0.5);
  } else if (vertexIndex == 6u) {
    return vec2f(1.0, -1.2);
  } else if (vertexIndex == 7u) {
    return vec2f(1.0, 1.2);
  }
  return vec2f(1.9, 0.0);
}

@vertex
fn vertex_refraction_debug(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> RefractionDebugVertexOutput {
  let arrow = refractionArrowInstances[instanceIndex];
  let delta = arrow.destination - arrow.source;
  // 长度下限避免零向量导致除零。
  let arrowLength = max(length(delta), 1e-4);
  let direction = delta / arrowLength;
  let perpendicular = vec2f(-direction.y, direction.x);
  // 头部长固定在 [2.4, 6.0] 像素区间，同时随箭头长度增长。
  let headLength = min(6.0, max(2.4, arrowLength * 0.45));
  let shaftLength = max(0.0, arrowLength - headLength);
  // 箭杆不能小于 1 像素量级，否则在首帧整齐对齐像素边界时容易被栅格化成断续点。
  // 这里略微加宽，但不改变 source/destination 端点位置，仍保持 1:1 位移表达。
  let shaftHalfWidth = 0.75;
  let headHalfWidth = headLength * 0.23;
  let templatePoint = select_refraction_debug_vertex(vertexIndex);

  var localPoint = vec2f(0.0);
  if (vertexIndex < 6u) {
    // 箭杆：从 source 朝 destination 延展。
    localPoint =
      arrow.source +
      direction * (templatePoint.x * shaftLength) +
      perpendicular * (templatePoint.y * shaftHalfWidth * 2.0);
  } else if (vertexIndex == 6u) {
    // 箭头左翼。
    localPoint =
      arrow.destination - direction * headLength + perpendicular * headHalfWidth;
  } else if (vertexIndex == 7u) {
    // 箭头右翼。
    localPoint =
      arrow.destination - direction * headLength - perpendicular * headHalfWidth;
  } else {
    // 箭尖严格落在最终显示位置，保证 1:1 对应实际位移终点。
    localPoint = arrow.destination;
  }

  var vertexOutput: RefractionDebugVertexOutput;
  vertexOutput.clipPosition = vec4f(canvas_to_clip(localPoint), 0.0, 1.0);
  // 使用白色以减少与背景色相冲突。
  vertexOutput.color = vec4f(1.0, 1.0, 1.0, 0.98);
  return vertexOutput;
}

@fragment
fn fragment_refraction_debug(
  vertexOutput: RefractionDebugVertexOutput,
) -> @location(0) vec4f {
  return vertexOutput.color;
}
