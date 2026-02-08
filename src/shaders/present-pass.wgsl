@fragment
fn fragment_present(vertexOutput: VertexOutput) -> @location(0) vec4f {
  // 上屏通道将已 cover 映射的场景纹理 1:1 绘制到屏幕。
  // 翻转纹理坐标的 y 轴。
  let textureCoordinates = vec2f(
    vertexOutput.textureCoordinates.x,
    1.0 - vertexOutput.textureCoordinates.y,
  );
  // 直接采样当前输入纹理。
  return vec4f(
    textureSampleLevel(primaryTexture, linearSampler, textureCoordinates, 0.0).rgb,
    1.0,
  );
}
