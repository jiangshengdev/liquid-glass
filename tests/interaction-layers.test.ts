import { describe, expect, it } from "vitest";

import {
  syncGlassHitLayerGeometry,
  syncInteractionLayers,
} from "../src/interaction/layers";
import type { GlassRect } from "../src/types/common";

function elementWithStyle(): HTMLElement {
  return {
    style: {},
  } as HTMLElement;
}

describe("interaction/layers", () => {
  it("关闭 debug 时释放背景 HTML 交互并让 canvas 不再截获全屏指针", () => {
    const canvas = elementWithStyle() as HTMLCanvasElement;
    const backgroundHtmlLayer = elementWithStyle() as HTMLDivElement;
    const glassHitLayer = elementWithStyle() as HTMLDivElement;

    syncInteractionLayers({
      canvas,
      backgroundHtmlLayer,
      glassHitLayer,
      debugActive: false,
    });

    expect(canvas.style.pointerEvents).toBe("none");
    expect(backgroundHtmlLayer.style.pointerEvents).toBe("auto");
    expect(glassHitLayer.style.pointerEvents).toBe("auto");
  });

  it("打开 debug 时禁用背景 HTML 交互并让 canvas 接管背景拖动", () => {
    const canvas = elementWithStyle() as HTMLCanvasElement;
    const backgroundHtmlLayer = elementWithStyle() as HTMLDivElement;
    const glassHitLayer = elementWithStyle() as HTMLDivElement;

    syncInteractionLayers({
      canvas,
      backgroundHtmlLayer,
      glassHitLayer,
      debugActive: true,
    });

    expect(canvas.style.pointerEvents).toBe("auto");
    expect(backgroundHtmlLayer.style.pointerEvents).toBe("none");
    expect(glassHitLayer.style.pointerEvents).toBe("auto");
  });

  it("将玻璃命中层同步到玻璃矩形位置", () => {
    const glassHitLayer = elementWithStyle() as HTMLDivElement;
    const glass: GlassRect = {
      left: 120,
      top: 80,
      width: 360,
      height: 112,
    };

    syncGlassHitLayerGeometry(glassHitLayer, glass);

    expect(glassHitLayer.style.left).toBe("120px");
    expect(glassHitLayer.style.top).toBe("80px");
    expect(glassHitLayer.style.width).toBe("360px");
    expect(glassHitLayer.style.height).toBe("112px");
  });
});
