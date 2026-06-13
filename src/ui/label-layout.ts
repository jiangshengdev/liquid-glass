import { clamp } from "../utils/math";

interface ComputeGlassButtonLabelFontSizeOptions {
  /** 玻璃按钮宽度，单位为 CSS 像素。 */
  width: number;
  /** 玻璃按钮高度，单位为 CSS 像素。 */
  height: number;
  /** 当前文本内容。 */
  text: string;
}

/** label 字体的最小字号，保证小尺寸下仍可读。 */
const MIN_LABEL_FONT_SIZE = 14;
/** label 字体的最大字号，避免大屏下过度膨胀。 */
const MAX_LABEL_FONT_SIZE = 42;
/** `Liquid Glass` 的经验宽度约束系数。 */
const DEFAULT_WIDTH_FACTOR = 9.5;

/**
 * 根据玻璃按钮尺寸计算覆盖文本字号。
 * @param options 玻璃按钮尺寸与文本内容。
 * @returns 字号，单位为 CSS 像素。
 */
export function computeGlassButtonLabelFontSize({
  width,
  height,
}: ComputeGlassButtonLabelFontSizeOptions): number {
  const heightBased = height * 0.28;
  const widthBased = width / DEFAULT_WIDTH_FACTOR;

  return clamp(
    Math.min(heightBased, widthBased),
    MIN_LABEL_FONT_SIZE,
    MAX_LABEL_FONT_SIZE,
  );
}
