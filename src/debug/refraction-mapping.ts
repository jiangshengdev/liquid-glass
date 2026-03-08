import type { GlassParams, GlassRect, Offset2D } from "../types/common";

/** 二维向量。 */
export interface Vec2 {
  /** x 分量。 */
  x: number;
  /** y 分量。 */
  y: number;
}

/** 单点折射评估结果。 */
export interface RefractionSample {
  /** 目标位置是否落在玻璃内部。 */
  inside: boolean;
  /** 目标位置到玻璃边界的有符号距离。 */
  signedDistance: number;
  /** 当前目标位置的折射偏移。 */
  offset: Vec2;
  /** 当前目标位置回采样到的源位置。 */
  source: Vec2;
}

/** 原始像素到显示位置的箭头。 */
export interface RefractionArrow {
  /** 原始未扭曲的位置。 */
  source: Vec2;
  /** 扭曲后实际显示的位置。 */
  destination: Vec2;
  /** 位移长度。 */
  displacement: number;
  /** 目标位置到边界的内部距离。 */
  distanceInside: number;
}

const EPSILON = 1e-6;
const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949;
const ZERO_OFFSET: Offset2D = { x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function saturate(value: number): number {
  return clamp(value, 0, 1);
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(value: Vec2, amount: number): Vec2 {
  return { x: value.x * amount, y: value.y * amount };
}

function length(value: Vec2): number {
  return Math.hypot(value.x, value.y);
}

function normalize(value: Vec2): Vec2 {
  const valueLength = length(value);
  if (valueLength <= EPSILON) return { x: 0, y: 0 };
  return scale(value, 1 / valueLength);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function centeredModulo(value: number, divisor: number): number {
  return positiveModulo(value + divisor * 0.5, divisor) - divisor * 0.5;
}

function overlayCenter(glass: GlassRect): Vec2 {
  return {
    x: glass.left + glass.width * 0.5,
    y: glass.top + glass.height * 0.5,
  };
}

function overlayHalfSize(glass: GlassRect): Vec2 {
  return {
    x: glass.width * 0.5,
    y: glass.height * 0.5,
  };
}

function signedDistanceRoundedRect(
  samplePosition: Vec2,
  halfSize: Vec2,
  radius: number,
): number {
  const qx = Math.abs(samplePosition.x) - (halfSize.x - radius);
  const qy = Math.abs(samplePosition.y) - (halfSize.y - radius);
  const outerX = Math.max(qx, 0);
  const outerY = Math.max(qy, 0);
  const outside = Math.hypot(outerX, outerY);
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function surfaceNormalAtPoint(
  pointInOverlay: Vec2,
  halfSize: Vec2,
  radius: number,
): Vec2 {
  const derivativeStep = 1;
  const gradientX =
    signedDistanceRoundedRect(
      { x: pointInOverlay.x + derivativeStep, y: pointInOverlay.y },
      halfSize,
      radius,
    ) -
    signedDistanceRoundedRect(
      { x: pointInOverlay.x - derivativeStep, y: pointInOverlay.y },
      halfSize,
      radius,
    );
  const gradientY =
    signedDistanceRoundedRect(
      { x: pointInOverlay.x, y: pointInOverlay.y + derivativeStep },
      halfSize,
      radius,
    ) -
    signedDistanceRoundedRect(
      { x: pointInOverlay.x, y: pointInOverlay.y - derivativeStep },
      halfSize,
      radius,
    );

  return normalize({ x: gradientX, y: gradientY });
}

/**
 * 用与 WGSL 相同的公式，评估某个显示位置的回采样源位置。
 * 这里的 `destination` 表示最终显示像素所在位置。
 */
export function sampleRefractionAtDestination(
  destination: Vec2,
  glass: GlassRect,
  params: GlassParams,
): RefractionSample {
  const center = overlayCenter(glass);
  const halfSize = overlayHalfSize(glass);
  const radius = glass.height * 0.5;
  const pointInOverlay = subtract(destination, center);
  const signedDistance = signedDistanceRoundedRect(
    pointInOverlay,
    halfSize,
    radius,
  );
  const inside = signedDistance <= 0;

  if (!inside) {
    return {
      inside: false,
      signedDistance,
      offset: { x: 0, y: 0 },
      source: destination,
    };
  }

  const distanceInside = Math.max(0, -signedDistance);
  const depthAmount = Math.max(1, radius * params.depth);
  const edgeFactor = saturate(1 - distanceInside / depthAmount);
  const edgeFactorSquared = edgeFactor * edgeFactor;
  const normal = surfaceNormalAtPoint(pointInOverlay, halfSize, radius);
  const offset = scale(normal, -params.refraction * edgeFactorSquared);

  return {
    inside,
    signedDistance,
    offset,
    source: add(destination, offset),
  };
}

/**
 * 根据沿边界的弧长偏移，返回胶囊边界上的一个采样点。
 * @param offset 沿边界前进的距离。
 * @param center 胶囊中心点。
 * @param coreHalfWidth 中央直线段的半长。
 * @param insetRadius 当前内缩层的圆角半径。
 * @returns 边界上的画布坐标。
 */
function pointOnInsetCapsuleBoundary(
  offset: number,
  center: Vec2,
  coreHalfWidth: number,
  insetRadius: number,
): Vec2 {
  const straightLength = coreHalfWidth * 2;
  const arcLength = Math.PI * insetRadius;
  const perimeter = straightLength * 2 + arcLength * 2;
  const wrappedOffset = positiveModulo(offset, perimeter);

  if (wrappedOffset < straightLength) {
    return {
      x: center.x - coreHalfWidth + wrappedOffset,
      y: center.y - insetRadius,
    };
  }

  if (wrappedOffset < straightLength + arcLength) {
    const arcOffset = wrappedOffset - straightLength;
    const angle = -Math.PI * 0.5 + arcOffset / insetRadius;
    return {
      x: center.x + coreHalfWidth + Math.cos(angle) * insetRadius,
      y: center.y + Math.sin(angle) * insetRadius,
    };
  }

  if (wrappedOffset < straightLength * 2 + arcLength) {
    const edgeOffset = wrappedOffset - (straightLength + arcLength);
    return {
      x: center.x + coreHalfWidth - edgeOffset,
      y: center.y + insetRadius,
    };
  }

  const arcOffset = wrappedOffset - (straightLength * 2 + arcLength);
  const angle = Math.PI * 0.5 + arcOffset / insetRadius;
  return {
    x: center.x - coreHalfWidth + Math.cos(angle) * insetRadius,
    y: center.y + Math.sin(angle) * insetRadius,
  };
}

/**
 * 按最终显示位置采样并追加一根有效折射箭头。
 * 箭头语义始终保持为：原始像素位置 -> 扭曲后显示位置。
 */
function appendRefractionArrowAtDestination(
  destination: Vec2,
  glass: GlassRect,
  params: GlassParams,
  arrows: RefractionArrow[],
): void {
  const sample = sampleRefractionAtDestination(destination, glass, params);
  if (!sample.inside) return;

  const displacement = length(subtract(destination, sample.source));
  if (displacement <= 0.1) return;

  arrows.push({
    source: sample.source,
    destination,
    displacement,
    distanceInside: Math.max(0, -sample.signedDistance),
  });
}

function segmentStartGap(startOffset: number): number {
  return startOffset <= EPSILON ? 0 : startOffset;
}

function segmentEndGap(
  segmentLength: number,
  startOffset: number,
  spacing: number,
): number {
  const gap = positiveModulo(segmentLength - startOffset, spacing);
  return gap <= EPSILON ? spacing : gap;
}

function buildTwoSidedArcOffsets(
  arcLength: number,
  startGap: number,
  endGap: number,
  spacing: number,
): number[] {
  const candidates: Array<{ offset: number; seamDistance: number }> = [];
  const minimumOffsetGap = Math.max(1, spacing * 0.35);
  const firstStartOffset = startGap <= EPSILON ? spacing : startGap;
  const firstEndGap = endGap <= EPSILON ? spacing : endGap;

  for (
    let seamDistance = firstStartOffset;
    seamDistance < arcLength;
    seamDistance += spacing
  ) {
    candidates.push({ offset: seamDistance, seamDistance });
  }

  for (
    let seamDistance = firstEndGap;
    seamDistance < arcLength;
    seamDistance += spacing
  ) {
    candidates.push({ offset: arcLength - seamDistance, seamDistance });
  }

  candidates.sort((a, b) => a.offset - b.offset);
  const offsets: Array<{ offset: number; seamDistance: number }> = [];

  for (const candidate of candidates) {
    const previous = offsets[offsets.length - 1];
    if (!previous || candidate.offset - previous.offset >= minimumOffsetGap) {
      offsets.push(candidate);
      continue;
    }

    if (candidate.seamDistance < previous.seamDistance) {
      offsets[offsets.length - 1] = candidate;
    }
  }

  return offsets.map((entry) => entry.offset);
}

function appendArcSamples(
  offsetsFromStart: number[],
  offsetToPoint: (offsetFromStart: number) => Vec2,
  glass: GlassRect,
  params: GlassParams,
  arrows: RefractionArrow[],
): void {
  for (const offsetFromStart of offsetsFromStart) {
    appendRefractionArrowAtDestination(
      offsetToPoint(offsetFromStart),
      glass,
      params,
      arrows,
    );
  }
}

/**
 * 直接按边界带分层采样箭头。
 * 箭头含义：原始像素位置 -> 经过折射后显示到的位置。
 * `samplingOffset.x` 控制沿边界切线方向的滑动，`samplingOffset.y` 控制边界带内部层的起始偏移。
 */
export function buildRefractionArrows(
  glass: GlassRect,
  params: GlassParams,
  spacing = 20,
  samplingOffset: Offset2D = ZERO_OFFSET,
): RefractionArrow[] {
  const arrows: RefractionArrow[] = [];
  const center = overlayCenter(glass);
  const halfSize = overlayHalfSize(glass);
  const radius = glass.height * 0.5;
  const coreHalfWidth = Math.max(0, halfSize.x - radius);
  const maxDistanceInside = Math.min(radius - EPSILON, radius * params.depth);
  const radialSpacing = Math.max(4, spacing * 0.45);

  if (maxDistanceInside <= EPSILON) return arrows;

  const tangentialShift = centeredModulo(samplingOffset.x, spacing);
  const radialShift = centeredModulo(samplingOffset.y, radialSpacing);
  let firstDistanceInside = radialSpacing * 0.5 + radialShift;
  while (firstDistanceInside <= EPSILON) {
    firstDistanceInside += radialSpacing;
  }

  for (
    let layerIndex = 0, distanceInside = firstDistanceInside;
    distanceInside <= maxDistanceInside;
    layerIndex += 1, distanceInside += radialSpacing
  ) {
    const insetRadius = radius - distanceInside;
    if (insetRadius <= EPSILON) continue;

    const straightLength = coreHalfWidth * 2;
    const arcLength = Math.PI * insetRadius;
    // 顶部/底部直线段单独按本地 x 坐标错开采样，
    // 避免底边再被右侧圆弧长度带偏后重叠成同一批竖列。
    const linePhase = positiveModulo(
      0.5 + layerIndex * GOLDEN_RATIO_CONJUGATE,
      1,
    );
    const lineOffset = positiveModulo(
      spacing * linePhase + tangentialShift,
      spacing,
    );

    if (straightLength > EPSILON) {
      for (
        let straightOffset = lineOffset;
        straightOffset < straightLength;
        straightOffset += spacing
      ) {
        const x = center.x - coreHalfWidth + straightOffset;
        appendRefractionArrowAtDestination(
          { x, y: center.y - insetRadius },
          glass,
          params,
          arrows,
        );
        appendRefractionArrowAtDestination(
          { x, y: center.y + insetRadius },
          glass,
          params,
          arrows,
        );
      }
    }

    if (arcLength <= EPSILON) continue;

    const leftSeamGap = segmentStartGap(lineOffset);
    const rightSeamGap = segmentEndGap(straightLength, lineOffset, spacing);
    const rightArcOffsets = buildTwoSidedArcOffsets(
      arcLength,
      rightSeamGap,
      rightSeamGap,
      spacing,
    );
    const leftArcOffsets = buildTwoSidedArcOffsets(
      arcLength,
      leftSeamGap,
      leftSeamGap,
      spacing,
    );

    appendArcSamples(
      rightArcOffsets,
      (offsetFromTop) =>
        pointOnInsetCapsuleBoundary(
          straightLength + offsetFromTop,
          center,
          coreHalfWidth,
          insetRadius,
        ),
      glass,
      params,
      arrows,
    );
    appendArcSamples(
      leftArcOffsets,
      (offsetFromBottom) =>
        pointOnInsetCapsuleBoundary(
          straightLength * 2 + arcLength + offsetFromBottom,
          center,
          coreHalfWidth,
          insetRadius,
        ),
      glass,
      params,
      arrows,
    );
  }

  return arrows;
}
