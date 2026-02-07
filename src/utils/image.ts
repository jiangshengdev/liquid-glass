export async function loadBitmap(url: string): Promise<ImageBitmap> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return createImageBitmap(img);
}

export function createImageTexture(device: GPUDevice, queue: GPUQueue, bitmap: ImageBitmap): GPUTexture {
  const texture = device.createTexture({
    size: { width: bitmap.width, height: bitmap.height },
    format: "rgba8unorm",
    // Some implementations require RenderAttachment for external image copies
    // (even if the texture is only sampled later).
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    { width: bitmap.width, height: bitmap.height },
  );

  return texture;
}
