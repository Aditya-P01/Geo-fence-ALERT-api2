'use strict';

const redis = require('../config/redis');
const logger = require('../utils/logger');

const DEVICE_STATE_TTL = parseInt(process.env.DEVICE_STATE_TTL || '86400', 10); // 24 hours

/**
 * Build the Redis key for a device-fence state pair.
 * Pattern: device:{deviceId}:fence:{fenceId}
 */
function stateKey(deviceId, fenceId) {
  return `device:${deviceId}:fence:${fenceId}`;
}

/**
 * Get the previous state of a device relative to a fence.
 * @returns {Promise<string|null>} "inside" or null (meaning outside/unknown)
 */
async function getDeviceState(deviceId, fenceId) {
  const key = stateKey(deviceId, fenceId);
  const state = await redis.get(key);
  return state; // "inside" or null
}

/**
 * Mark a device as inside a fence. Sets key with 24-hour TTL.
 */
async function setDeviceInside(deviceId, fenceId) {
  const key = stateKey(deviceId, fenceId);
  await redis.set(key, 'inside', 'EX', DEVICE_STATE_TTL);
  logger.debug(`State set: ${key} → inside (TTL: ${DEVICE_STATE_TTL}s)`);
}

/**
 * Mark a device as outside a fence by deleting the key.
 * Absence of key = outside (natural default).
 */
async function setDeviceOutside(deviceId, fenceId) {
  const key = stateKey(deviceId, fenceId);
  await redis.del(key);
  logger.debug(`State cleared: ${key} (device is outside)`);
}

/**
 * Get all fence IDs that a device is currently inside.
 * Uses SCAN pattern matching: device:{deviceId}:fence:*
 * @returns {Promise<string[]>} Array of fence IDs
 */
async function getDeviceInsideFences(deviceId) {
  const pattern = `device:${deviceId}:fence:*`;
  const keys = [];
  let cursor = '0';

  // Use SCAN instead of KEYS for production safety (non-blocking)
  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');

  // Extract fence IDs from key pattern
  return keys.map(key => {
    const parts = key.split(':fence:');
    return parts[1] || key;
  });
}

/**
 * Clear all state for a device (useful for testing).
 */
async function clearDeviceState(deviceId) {
  const pattern = `device:${deviceId}:fence:*`;
  const keys = [];
  let cursor = '0';

  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');

  if (keys.length > 0) {
    await redis.del(...keys);
    logger.debug(`Cleared ${keys.length} state keys for device ${deviceId}`);
  }
}

module.exports = {
  getDeviceState,
  setDeviceInside,
  setDeviceOutside,
  getDeviceInsideFences,
  clearDeviceState,
};
