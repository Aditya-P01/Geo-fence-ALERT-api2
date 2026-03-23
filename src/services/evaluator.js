'use strict';

const { point, polygon } = require('@turf/helpers');
const distance = require('@turf/distance').default;
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const logger = require('../utils/logger');

/**
 * Determine if a device is inside a given geo-fence.
 *
 * IMPORTANT: Turf.js uses GeoJSON standard — coordinates are [lng, lat] NOT [lat, lng].
 *
 * @param {Object} fence  - Fence row from DB (type, center_lat/lng, radius_m, polygon_json)
 * @param {number} lat    - Device latitude
 * @param {number} lng    - Device longitude
 * @returns {boolean}     - true if device is inside the fence
 */
function isInsideFence(fence, lat, lng) {
  try {
    // Turf.js requires [longitude, latitude] order (GeoJSON standard)
    const devicePoint = point([lng, lat]);

    if (fence.type === 'circle') {
      return isInsideCircle(fence, devicePoint);
    } else if (fence.type === 'polygon') {
      return isInsidePolygon(fence, devicePoint);
    } else {
      logger.warn(`Unknown fence type: ${fence.type} (fence ${fence.id})`);
      return false;
    }
  } catch (err) {
    logger.error(`Evaluator error for fence ${fence.id}: ${err.message}`);
    return false;
  }
}

/**
 * Circle fence: compare turf.distance against radius.
 */
function isInsideCircle(fence, devicePoint) {
  const centerLat = fence.center_lat;
  const centerLng = fence.center_lng;
  const radiusMeters = fence.radius_m;

  if (centerLat == null || centerLng == null || radiusMeters == null) {
    logger.warn(`Circle fence ${fence.id} missing center/radius fields`);
    return false;
  }

  // Center point in [lng, lat] order
  const centerPoint = point([centerLng, centerLat]);

  // distance() returns kilometers by default
  const distanceKm = distance(devicePoint, centerPoint, { units: 'kilometers' });
  const radiusKm = radiusMeters / 1000;

  return distanceKm <= radiusKm;
}

/**
 * Polygon fence: use turf.booleanPointInPolygon with ray-casting algorithm.
 */
function isInsidePolygon(fence, devicePoint) {
  let coordinates = fence.polygon_json;

  // Parse if stored as string
  if (typeof coordinates === 'string') {
    coordinates = JSON.parse(coordinates);
  }

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 4) {
    logger.warn(`Polygon fence ${fence.id} has invalid coordinates`);
    return false;
  }

  // Convert [{lat, lng}, ...] to [[lng, lat], ...] for GeoJSON
  const ring = coordinates.map(coord => [coord.lng, coord.lat]);

  // Turf polygon expects an array of rings (outer ring first)
  const poly = polygon([ring]);

  return booleanPointInPolygon(devicePoint, poly);
}

module.exports = { isInsideFence };
