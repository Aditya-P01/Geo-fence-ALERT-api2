'use strict';

const { isInsideFence } = require('../../src/services/evaluator');

/**
 * Unit tests for the geospatial evaluator.
 *
 * These tests use real-world coordinates and verify that Turf.js
 * correctly handles both circle (distance) and polygon (point-in-polygon)
 * calculations with the GeoJSON [lng, lat] coordinate order.
 */

// ── Circle Fence Tests ────────────────────────────────────────
describe('isInsideFence — Circle', () => {
  // Circle fence: center at India Gate, New Delhi (28.6129, 77.2295), radius 500m
  const circleFence = {
    id: 'test-circle-fence',
    name: 'India Gate Zone',
    type: 'circle',
    center_lat: 28.6129,
    center_lng: 77.2295,
    radius_m: 500,
  };

  test('should return TRUE for a point clearly inside (≈210m from center)', () => {
    // Point ~210m north of India Gate
    const result = isInsideFence(circleFence, 28.6148, 77.2295);
    expect(result).toBe(true);
  });

  test('should return TRUE for a point at the exact center', () => {
    const result = isInsideFence(circleFence, 28.6129, 77.2295);
    expect(result).toBe(true);
  });

  test('should return FALSE for a point clearly outside (≈2km away)', () => {
    // Point ~2km south of India Gate
    const result = isInsideFence(circleFence, 28.5950, 77.2295);
    expect(result).toBe(false);
  });

  test('should return FALSE for a point far away (different city)', () => {
    // Mumbai coordinates
    const result = isInsideFence(circleFence, 19.0760, 72.8777);
    expect(result).toBe(false);
  });

  test('should handle missing center fields gracefully', () => {
    const brokenFence = { id: 'broken', type: 'circle', center_lat: null, center_lng: null, radius_m: 100 };
    const result = isInsideFence(brokenFence, 28.6129, 77.2295);
    expect(result).toBe(false);
  });
});

// ── Polygon Fence Tests ───────────────────────────────────────
describe('isInsideFence — Polygon', () => {
  // Rectangular polygon around Connaught Place, New Delhi
  const polygonFence = {
    id: 'test-polygon-fence',
    name: 'Connaught Place Market',
    type: 'polygon',
    polygon_json: [
      { lat: 28.6300, lng: 77.2100 },
      { lat: 28.6300, lng: 77.2250 },
      { lat: 28.6350, lng: 77.2250 },
      { lat: 28.6350, lng: 77.2100 },
      { lat: 28.6300, lng: 77.2100 }, // closing point
    ],
  };

  test('should return TRUE for a point clearly inside the rectangle', () => {
    // Center of the rectangle
    const result = isInsideFence(polygonFence, 28.6325, 77.2175);
    expect(result).toBe(true);
  });

  test('should return FALSE for a point clearly outside the rectangle', () => {
    // Point well outside (south of the polygon)
    const result = isInsideFence(polygonFence, 28.6200, 77.2175);
    expect(result).toBe(false);
  });

  test('should return FALSE for a point east of the polygon', () => {
    const result = isInsideFence(polygonFence, 28.6325, 77.2400);
    expect(result).toBe(false);
  });

  test('should handle polygon_json as a JSON string', () => {
    const fenceWithString = {
      ...polygonFence,
      polygon_json: JSON.stringify(polygonFence.polygon_json),
    };
    const result = isInsideFence(fenceWithString, 28.6325, 77.2175);
    expect(result).toBe(true);
  });

  test('should handle invalid polygon data gracefully', () => {
    const brokenFence = { id: 'broken', type: 'polygon', polygon_json: null };
    const result = isInsideFence(brokenFence, 28.6325, 77.2175);
    expect(result).toBe(false);
  });

  test('should handle too few coordinates gracefully', () => {
    const badFence = {
      id: 'bad',
      type: 'polygon',
      polygon_json: [{ lat: 28.63, lng: 77.21 }, { lat: 28.64, lng: 77.22 }],
    };
    const result = isInsideFence(badFence, 28.635, 77.215);
    expect(result).toBe(false);
  });
});

// ── Unknown Fence Type ────────────────────────────────────────
describe('isInsideFence — Unknown type', () => {
  test('should return FALSE for an unknown fence type', () => {
    const weirdFence = { id: 'weird', type: 'hexagon', center_lat: 28.6129, center_lng: 77.2295 };
    const result = isInsideFence(weirdFence, 28.6129, 77.2295);
    expect(result).toBe(false);
  });
});
