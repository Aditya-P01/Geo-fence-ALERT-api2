'use strict';

const db = require('../config/db');
const logger = require('../utils/logger');

// ── REGISTER ──────────────────────────────────────────────────
const registerWebhook = async (req, res, next) => {
  try {
    const { url, description, fence_ids, event_types, secret } = req.body;

    // Check for duplicate URL
    const existing = await db.query(
      'SELECT id FROM webhooks WHERE url = $1',
      [url]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `Webhook already registered for URL: ${url}`,
          existing_id: existing.rows[0].id,
          status: 409,
        },
      });
    }

    const result = await db.query(
      `INSERT INTO webhooks (url, description, fence_ids, event_types, secret, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [
        url,
        description || null,
        fence_ids || null,
        event_types || ['ENTER', 'EXIT'],
        secret || null,
      ]
    );

    logger.info(`Webhook registered: ${result.rows[0].id} → ${url}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── LIST ALL ──────────────────────────────────────────────────
const getAllWebhooks = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM webhooks ORDER BY created_at DESC'
    );

    res.json({
      webhooks: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET BY ID ─────────────────────────────────────────────────
const getWebhookById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM webhooks WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `No webhook found with id: ${id}`,
          status: 404,
        },
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE ────────────────────────────────────────────────────
const updateWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, event_types, description, fence_ids, secret } = req.body;

    const result = await db.query(
      `UPDATE webhooks
       SET is_active    = COALESCE($1, is_active),
           event_types  = COALESCE($2, event_types),
           description  = COALESCE($3, description),
           fence_ids    = COALESCE($4, fence_ids),
           secret       = COALESCE($5, secret),
           updated_at   = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        is_active !== undefined ? is_active : null,
        event_types || null,
        description !== undefined ? description : null,
        fence_ids !== undefined ? fence_ids : null,
        secret !== undefined ? secret : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `No webhook found with id: ${id}`,
          status: 404,
        },
      });
    }

    logger.info(`Webhook updated: ${id}`);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── DELETE (soft) ─────────────────────────────────────────────
const deleteWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE webhooks
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `No active webhook found with id: ${id}`,
          status: 404,
        },
      });
    }

    logger.info(`Webhook soft-deleted: ${id}`);
    res.json({ message: 'Webhook deleted successfully', id });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerWebhook,
  getAllWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
};
