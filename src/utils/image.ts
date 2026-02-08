/**
 * 加载图片并解码为 `ImageBitmap`。
 * @param url 图片地址。
 * @returns 解码后的位图对象。
 */
export async function loadBitmap(url: string): Promise<ImageBitmap> {
  // 创建图片元素用于解码。
  const imageElement = new Image();
  // 采用异步解码，避免阻塞主线程。
  imageElement.decoding = "async";
  // 设置图片地址并触发加载。
  imageElement.src = url;
  // 等待浏览器完成解码。
  await imageElement.decode();
  // 转换为 ImageBitmap 以便上传到 GPU。
  return createImageBitmap(imageElement);
}

/**
 * 基于位图创建可采样纹理，并复制像素数据到 GPU。
 * @param device GPU 设备。
 * @param queue GPU 队列。
 * @param bitmap 源位图。
 * @returns 已填充内容的纹理对象。
 */
export function createImageTexture(
  device: GPUDevice,
  queue: GPUQueue,
  bitmap: ImageBitmap,
): GPUTexture {
  // 纹理尺寸与位图一致。
  const texture = device.createTexture({
    size: { width: bitmap.width, height: bitmap.height },
    format: "rgba8unorm",
    // 某些实现对外部图片拷贝要求包含 RENDER_ATTACHMENT。
    // 即便后续仅作为采样纹理使用，这里也保留该 usage 以增强兼容性。
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // 将外部图片内容复制到 GPU 纹理。
  queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    { width: bitmap.width, height: bitmap.height },
  );

  // 返回已填充像素的纹理。
  return texture;
}
