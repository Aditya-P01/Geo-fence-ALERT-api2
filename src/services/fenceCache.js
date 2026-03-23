'use strict';

const redis = require('../config/redis');
const db = require('../config/db');
const logger = require('../utils/logger');

const CACHE_KEY = 'fences:active';
const CACHE_TTL = parseInt(process.env.FENCE_CACHE_TTL || '300', 10); // 5 minutes

/**
 * Get all active fences — Redis cache first, PostgreSQL fallback.
 * @returns {Promise<Array>} Array of active fence objects
 */
async function getActiveFences() {
  try {
    // Try cache first
    const cached = await redis.get(CACHE_KEY);

    if (cached) {
      logger.debug('Fence cache HIT');
      return JSON.parse(cached);
    }

    // Cache MISS — query database
    logger.debug('Fence cache MISS — loading from PostgreSQL');
    const result = await db.query(
      'SELECT * FROM geo_fences WHERE is_active = TRUE ORDER BY created_at DESC'
    );

    const fences = result.rows;

    // Store in Redis with TTL
    await redis.set(CACHE_KEY, JSON.stringify(fences), 'EX', CACHE_TTL);
    logger.debug(`Cached ${fences.length} active fences (TTL: ${CACHE_TTL}s)`);

    return fences;
  } catch (err) {
    logger.error('FenceCache error:', err.message);

    // If Redis is down, fall back to direct DB query
    try {
      const result = await db.query(
        'SELECT * FROM geo_fences WHERE is_active = TRUE ORDER BY created_at DESC'
      );
      return result.rows;
    } catch (dbErr) {
      logger.error('FenceCache DB fallback also failed:', dbErr.message);
      return [];
    }
  }
}

/**
 * Invalidate the fence cache — call after any fence create/update/delete.
 */
async function invalidateCache() {
  try {
    await redis.del(CACHE_KEY);
    logger.debug('Fence cache invalidated');
  } catch (err) {
    logger.error('Failed to invalidate fence cache:', err.message);
  }
}

module.exports = { getActiveFences, invalidateCache };
