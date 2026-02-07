export async function loadBitmap(url) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return await createImageBitmap(img);
}

export function createImageTexture(device, queue, bitmap) {
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
