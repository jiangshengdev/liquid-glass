import { describe, expect, it } from "vitest";

import {
  buildLabelTextureDescriptor,
  computeLabelTextureSize,
} from "../src/gpu/label-texture";

describe("gpu/label-texture", () => {
  it("rounds texture size up to contain the browser copy range", () => {
    const size = computeLabelTextureSize({
      cssWidth: 919.6,
      cssHeight: 280,
      devicePixelRatio: 2,
    });

    expect(size).toEqual({ width: 1840, height: 560 });
  });

  it("uses rendered DOM size when it is larger than state size", () => {
    const size = computeLabelTextureSize({
      cssWidth: 919.5,
      cssHeight: 280,
      devicePixelRatio: 2,
      renderedCssWidth: 1840,
      renderedCssHeight: 280,
    });

    expect(size).toEqual({ width: 3680, height: 560 });
  });

  it("includes the usages required by copyElementImageToTexture", () => {
    const usage = {
      TEXTURE_BINDING: 1,
      COPY_DST: 2,
      RENDER_ATTACHMENT: 4,
    };

    const descriptor = buildLabelTextureDescriptor({
      width: 320,
      height: 96,
      usage,
    });

    expect(descriptor.usage & usage.TEXTURE_BINDING).toBe(
      usage.TEXTURE_BINDING,
    );
    expect(descriptor.usage & usage.COPY_DST).toBe(usage.COPY_DST);
    expect(descriptor.usage & usage.RENDER_ATTACHMENT).toBe(
      usage.RENDER_ATTACHMENT,
    );
  });
});
