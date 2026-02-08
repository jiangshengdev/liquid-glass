/**
 * 加载图片并解码为 `ImageBitmap`。
 * @param url 图片地址。
 * @returns 解码后的位图对象。
 */
export async function loadBitmap(url: string): Promise<ImageBitmap> {
  const imageElement = new Image();
  imageElement.decoding = "async";
  imageElement.src = url;
  await imageElement.decode();
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

  queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    { width: bitmap.width, height: bitmap.height },
  );

  return texture;
}
