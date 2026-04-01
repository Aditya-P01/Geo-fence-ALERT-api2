'use strict';

const { isInsideFence } = require('../services/evaluator');
const { getActiveFences } = require('../services/fenceCache');
const { getDeviceState, setDeviceInside, setDeviceOutside, getDeviceInsideFences } = require('../services/stateTracker');
const { saveAlert, dispatchAlert } = require('../services/alertDispatcher');
const logger = require('../utils/logger');

/**
 * POST /api/v1/locations/:deviceId
 *
 * Core orchestrator — the brain of the system:
 * 1. Load active fences from cache
 * 2. Evaluate which fences the device is inside (Turf.js)
 * 3. Compare against previous state in Redis
 * 4. Fire ENTER/EXIT alerts on state transitions
 * 5. Return events fired + current fence membership
 */
const processLocation = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { deviceId } = req.params;
    const { lat, lng, timestamp, metadata } = req.body;

    // Get Socket.IO instance for live event broadcasting
    const io = req.app.get('io');

    // 1. Load all active fences
    const fences = await getActiveFences();
    logger.debug(`Evaluating ${fences.length} active fences for device ${deviceId}`);

    // 2. Evaluate each fence — which ones is the device currently inside?
    const currentlyInside = [];
    const evaluationResults = new Map(); // fenceId → boolean

    for (const fence of fences) {
      const inside = isInsideFence(fence, lat, lng);
      evaluationResults.set(fence.id, inside);
      if (inside) {
        currentlyInside.push({
          fence_id: fence.id,
          fence_name: fence.name,
        });
      }
    }

    // 3. State comparison — detect transitions
    const eventsFired = [];

    for (const fence of fences) {
      const isInsideNow = evaluationResults.get(fence.id);
      const previousState = await getDeviceState(deviceId, fence.id);
      const wasInside = previousState === 'inside';

      if (!wasInside && isInsideNow) {
        // ──── ENTER event ──────────────────────────────────
        logger.info(`ENTER detected: device ${deviceId} entered fence ${fence.name} (${fence.id})`);

        // Save alert to PostgreSQL
        const alert = await saveAlert({
          fenceId: fence.id,
          deviceId,
          eventType: 'ENTER',
          lat,
          lng,
          metadata,
        });

        // Fire webhooks asynchronously (don't block response)
        dispatchAlert(alert, fence).catch(err =>
          logger.error(`Async dispatch error: ${err.message}`)
        );

        // Update Redis state
        await setDeviceInside(deviceId, fence.id);

        const enterEvent = {
          fence_id: fence.id,
          fence_name: fence.name,
          event_type: 'ENTER',
          alert_id: alert.id,
          device_id: deviceId,
          location: { lat, lng },
          timestamp: new Date().toISOString(),
        };

        // Broadcast to all connected WebSocket clients
        if (io) io.emit('geo_alert', enterEvent);

        eventsFired.push(enterEvent);

      } else if (wasInside && !isInsideNow) {
        // ──── EXIT event ───────────────────────────────────
        logger.info(`EXIT detected: device ${deviceId} exited fence ${fence.name} (${fence.id})`);

        const alert = await saveAlert({
          fenceId: fence.id,
          deviceId,
          eventType: 'EXIT',
          lat,
          lng,
          metadata,
        });

        dispatchAlert(alert, fence).catch(err =>
          logger.error(`Async dispatch error: ${err.message}`)
        );

        // Clear Redis state (absence of key = outside)
        await setDeviceOutside(deviceId, fence.id);

        const exitEvent = {
          fence_id: fence.id,
          fence_name: fence.name,
          event_type: 'EXIT',
          alert_id: alert.id,
          device_id: deviceId,
          location: { lat, lng },
          timestamp: new Date().toISOString(),
        };

        // Broadcast to all connected WebSocket clients
        if (io) io.emit('geo_alert', exitEvent);

        eventsFired.push(exitEvent);

      } else if (wasInside && isInsideNow) {
        // ──── Still inside — refresh TTL ───────────────────
        await setDeviceInside(deviceId, fence.id);
      }
      // else: was outside and still outside — no action needed
    }

    const processingTime = Date.now() - startTime;

    res.json({
      device_id: deviceId,
      location: {
        lat,
        lng,
        timestamp: timestamp || new Date().toISOString(),
      },
      events_fired: eventsFired,
      currently_inside: currentlyInside,
      evaluated_fences: fences.length,
      processing_time_ms: processingTime,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/locations/:deviceId/state
 *
 * Query which fences a device is currently inside.
 */
const getDeviceCurrentState = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const fenceIds = await getDeviceInsideFences(deviceId);

    res.json({
      device_id: deviceId,
      inside_fence_ids: fenceIds,
      total: fenceIds.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  processLocation,
  getDeviceCurrentState,
};
