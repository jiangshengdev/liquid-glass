import type { GlassParams, GlassRect } from "../types/common";

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
 * 直接按最终显示位置采样箭头。
 * 箭头含义：原始像素位置 -> 经过折射后显示到的位置。
 */
export function buildRefractionArrows(
  glass: GlassRect,
  params: GlassParams,
  spacing = 20,
): RefractionArrow[] {
  const arrows: RefractionArrow[] = [];
  const minX = glass.left;
  const maxX = glass.left + glass.width;
  const minY = glass.top;
  const maxY = glass.top + glass.height;

  for (let y = minY; y <= maxY; y += spacing) {
    for (let x = minX; x <= maxX; x += spacing) {
      const destination = { x, y };
      const sample = sampleRefractionAtDestination(destination, glass, params);
      if (!sample.inside) continue;

      const displacement = length(subtract(destination, sample.source));
      if (displacement <= 0.1) continue;

      arrows.push({
        source: sample.source,
        destination,
        displacement,
        distanceInside: Math.max(0, -sample.signedDistance),
      });
    }
  }

  return arrows;
}
