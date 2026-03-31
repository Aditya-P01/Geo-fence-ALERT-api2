'use strict';

const axios = require('axios');
const db = require('../config/db');
const logger = require('../utils/logger');

const WEBHOOK_TIMEOUT = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000', 10);

/**
 * Save an alert event to PostgreSQL.
 * @returns {Promise<Object>} The created alert row
 */
async function saveAlert({ fenceId, deviceId, eventType, lat, lng, metadata }) {
  const result = await db.query(
    `INSERT INTO alert_events (fence_id, device_id, event_type, device_lat, device_lng, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [fenceId, deviceId, eventType, lat, lng, JSON.stringify(metadata || {})]
  );

  logger.info(`Alert saved: ${result.rows[0].id} (${eventType} — device ${deviceId}, fence ${fenceId})`);
  return result.rows[0];
}

/**
 * Get all active webhooks that should receive a given event type.
 * If webhook has fence_ids set, only match those fences.
 * @returns {Promise<Array>} Matching webhook rows
 */
async function getActiveWebhooks(eventType, fenceId) {
  const result = await db.query(
    `SELECT * FROM webhooks
     WHERE is_active = TRUE
       AND ($1 = ANY(event_types) OR event_types IS NULL)
       AND (fence_ids IS NULL OR $2 = ANY(fence_ids))`,
    [eventType, fenceId]
  );
  return result.rows;
}

/**
 * Send a webhook HTTP POST and update delivery status.
 */
async function sendWebhook(webhook, payload, alertId) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'GeoFenceAlert/1.0',
    };

    // HMAC signature if webhook has a secret
    if (webhook.secret) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Geo-Signature'] = `sha256=${signature}`;
    }

    await axios.post(webhook.url, payload, {
      headers,
      timeout: WEBHOOK_TIMEOUT,
    });

    // Mark as delivered
    await db.query(
      `UPDATE alert_events SET delivery_status = 'delivered' WHERE id = $1`,
      [alertId]
    );

    logger.info(`Webhook delivered: ${webhook.url} for alert ${alertId}`);
  } catch (err) {
    // Mark as failed
    await db.query(
      `UPDATE alert_events SET delivery_status = 'failed' WHERE id = $1`,
      [alertId]
    );

    logger.error(`Webhook failed: ${webhook.url} — ${err.message}`);
  }
}

/**
 * Dispatch an alert: load webhooks, build payload, send to all in parallel.
 * This runs asynchronously — does NOT block the API response.
 */
async function dispatchAlert(alert, fence) {
  try {
    const webhooks = await getActiveWebhooks(alert.event_type, alert.fence_id);

    if (webhooks.length === 0) {
      logger.debug(`No webhooks registered for ${alert.event_type} on fence ${alert.fence_id}`);
      return;
    }

    // Build the payload that webhook receivers will get
    const payload = {
      event: 'geo_fence_alert',
      alert_id: alert.id,
      fence_id: alert.fence_id,
      fence_name: fence.name,
      device_id: alert.device_id,
      event_type: alert.event_type,
      location: {
        lat: alert.device_lat,
        lng: alert.device_lng,
      },
      timestamp: alert.created_at,
      metadata: fence.metadata || {},
    };

    // Send to all webhooks in parallel — one failure doesn't block others
    const results = await Promise.allSettled(
      webhooks.map(wh => sendWebhook(wh, payload, alert.id))
    );

    const delivered = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    logger.info(`Alert ${alert.id}: ${delivered} delivered, ${failed} failed out of ${webhooks.length} webhooks`);
  } catch (err) {
    logger.error(`Dispatch error for alert ${alert.id}: ${err.message}`);
  }
}

module.exports = {
  saveAlert,
  getActiveWebhooks,
  sendWebhook,
  dispatchAlert,
};
