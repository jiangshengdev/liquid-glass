import { describe, expect, it } from "vitest";

import {
  buildRefractionArrows,
  sampleRefractionAtDestination,
} from "../src/debug/refraction-mapping";
import type { GlassParams, GlassRect } from "../src/types/common";

const glass: GlassRect = {
  left: 100,
  top: 100,
  width: 360,
  height: 120,
};

const params: GlassParams = {
  refraction: 56,
  depth: 0.35,
  dispersion: 0,
  frost: 4,
  splay: 0,
  lightAngleDeg: -45,
  lightStrength: 0.8,
  alpha: 1,
};

describe("debug/refraction-mapping", () => {
  it("keeps center point unmoved", () => {
    const center = {
      x: glass.left + glass.width * 0.5,
      y: glass.top + glass.height * 0.5,
    };

    const sample = sampleRefractionAtDestination(center, glass, params);

    expect(sample.inside).toBe(true);
    expect(sample.offset.x).toBeCloseTo(0, 6);
    expect(sample.offset.y).toBeCloseTo(0, 6);
  });

  it("builds arrows directly from displayed positions in the edge band", () => {
    const arrows = buildRefractionArrows(glass, params, 12);

    expect(arrows.length).toBeGreaterThan(50);

    const strongestArrow = arrows.reduce((best, arrow) =>
      arrow.displacement > best.displacement ? arrow : best,
    );
    const sampled = sampleRefractionAtDestination(
      strongestArrow.destination,
      glass,
      params,
    );

    expect(sampled.source.x).toBeCloseTo(strongestArrow.source.x, 6);
    expect(sampled.source.y).toBeCloseTo(strongestArrow.source.y, 6);
  });

  it("samples multiple inset layers across the refraction band", () => {
    const arrows = buildRefractionArrows(glass, params, 14);
    const layerKeys = new Set(
      arrows.map((arrow) => arrow.distanceInside.toFixed(2)),
    );

    expect(layerKeys.size).toBeGreaterThan(2);
  });

  it("spreads top-edge layers across multiple horizontal phases", () => {
    const spacing = 14;
    const arrows = buildRefractionArrows(glass, params, spacing);
    const radius = glass.height * 0.5;
    const topStraightArrows = arrows.filter(
      (arrow) =>
        arrow.destination.y < glass.top + radius * params.depth + 1 &&
        arrow.destination.x > glass.left + radius + 24 &&
        arrow.destination.x < glass.left + glass.width - radius - 24,
    );
    const phaseKeys = new Set(
      topStraightArrows.map((arrow) =>
        (((arrow.destination.x - glass.left) % spacing) + spacing).toFixed(2),
      ),
    );

    expect(phaseKeys.size).toBeGreaterThan(2);
  });

  it("keeps bottom straight-edge phases aligned with the top edge", () => {
    const spacing = 14;
    const arrows = buildRefractionArrows(glass, params, spacing);
    const radius = glass.height * 0.5;
    const edgeMargin = 24;
    const topStraightArrows = arrows.filter(
      (arrow) =>
        arrow.destination.y < glass.top + radius * params.depth + 1 &&
        arrow.destination.x > glass.left + radius + edgeMargin &&
        arrow.destination.x < glass.left + glass.width - radius - edgeMargin,
    );
    const bottomStraightArrows = arrows.filter(
      (arrow) =>
        arrow.destination.y >
          glass.top + glass.height - radius * params.depth - 1 &&
        arrow.destination.x > glass.left + radius + edgeMargin &&
        arrow.destination.x < glass.left + glass.width - radius - edgeMargin,
    );
    const collectPhaseKeys = (sampledArrows: typeof arrows) =>
      [
        ...new Set(
          sampledArrows.map((arrow) =>
            (((arrow.destination.x - glass.left) % spacing) + spacing).toFixed(
              2,
            ),
          ),
        ),
      ].sort();

    expect(collectPhaseKeys(bottomStraightArrows)).toEqual(
      collectPhaseKeys(topStraightArrows),
    );
  });
  it("offsets arrow sampling when a background drag delta is provided", () => {
    const baseArrows = buildRefractionArrows(glass, params, 20);
    const offsetArrows = buildRefractionArrows(glass, params, 20, {
      x: 9,
      y: 4,
    });

    expect(offsetArrows.length).toBeGreaterThan(0);
    expect(offsetArrows[0].destination.x).not.toBeCloseTo(
      baseArrows[0].destination.x,
      6,
    );

    const strongestOffsetArrow = offsetArrows.reduce((best, arrow) =>
      arrow.displacement > best.displacement ? arrow : best,
    );
    const sampled = sampleRefractionAtDestination(
      strongestOffsetArrow.destination,
      glass,
      params,
    );

    expect(sampled.source.x).toBeCloseTo(strongestOffsetArrow.source.x, 6);
    expect(sampled.source.y).toBeCloseTo(strongestOffsetArrow.source.y, 6);
  });

  it("keeps arc sampling continuous at the top-right and bottom-right seams", () => {
    const spacing = 20;
    const arrows = buildRefractionArrows(glass, params, spacing);
    const outerLayerDistance = Math.min(
      ...arrows.map((arrow) => arrow.distanceInside),
    );
    const outerLayerArrows = arrows.filter(
      (arrow) => Math.abs(arrow.distanceInside - outerLayerDistance) < 0.01,
    );
    const radius = glass.height * 0.5;
    const insetRadius = radius - outerLayerDistance;
    const rightArcCenterX = glass.left + glass.width - radius;
    const rightArcCenterY = glass.top + radius;
    const topStraightY = glass.top + outerLayerDistance;
    const topStraightArrows = outerLayerArrows
      .filter(
        (arrow) =>
          Math.abs(arrow.destination.y - topStraightY) < 0.01 &&
          arrow.destination.x <= rightArcCenterX,
      )
      .sort((a, b) => a.destination.x - b.destination.x);
    const rightSeamGap =
      rightArcCenterX -
      topStraightArrows[topStraightArrows.length - 1].destination.x;
    const rightArcOffsets = outerLayerArrows
      .filter((arrow) => arrow.destination.x >= rightArcCenterX)
      .map((arrow) => {
        const angle = Math.atan2(
          arrow.destination.y - rightArcCenterY,
          arrow.destination.x - rightArcCenterX,
        );
        return (angle + Math.PI * 0.5) * insetRadius;
      })
      .sort((a, b) => a - b);

    expect(rightArcOffsets[0]).toBeCloseTo(rightSeamGap, 6);
    expect(
      Math.PI * insetRadius - rightArcOffsets[rightArcOffsets.length - 1],
    ).toBeCloseTo(rightSeamGap, 6);
  });
});
