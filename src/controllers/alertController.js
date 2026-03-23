'use strict';

const db = require('../config/db');
const logger = require('../utils/logger');

// ── LIST ALL (with filtering & pagination) ────────────────────
const getAllAlerts = async (req, res, next) => {
  try {
    const {
      device_id,
      fence_id,
      event_type,
      delivery_status,
      page: rawPage,
      limit: rawLimit,
    } = req.query;

    const page  = Math.max(1, parseInt(rawPage || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit || '20', 10)));
    const offset = (page - 1) * limit;

    // Dynamic WHERE clause — always starts with 1=1 for easy appending
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (device_id) {
      params.push(device_id);
      whereClause += ` AND ae.device_id = $${params.length}`;
    }
    if (fence_id) {
      params.push(fence_id);
      whereClause += ` AND ae.fence_id = $${params.length}`;
    }
    if (event_type) {
      params.push(event_type.toUpperCase());
      whereClause += ` AND ae.event_type = $${params.length}`;
    }
    if (delivery_status) {
      params.push(delivery_status);
      whereClause += ` AND ae.delivery_status = $${params.length}`;
    }

    // Count total results (for pagination metadata)
    const countQuery = `
      SELECT COUNT(*) FROM alert_events ae
      ${whereClause}
    `;

    // Data query with join for fence info
    const dataQuery = `
      SELECT ae.*,
             gf.name  AS fence_name,
             gf.type  AS fence_type
      FROM alert_events ae
      LEFT JOIN geo_fences gf ON ae.fence_id = gf.id
      ${whereClause}
      ORDER BY ae.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Run count and data queries in parallel
    const [countResult, dataResult] = await Promise.all([
      db.query(countQuery, params),
      db.query(dataQuery, [...params, limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      alerts: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET BY ID ─────────────────────────────────────────────────
const getAlertById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT ae.*,
              gf.name  AS fence_name,
              gf.type  AS fence_type
       FROM alert_events ae
       LEFT JOIN geo_fences gf ON ae.fence_id = gf.id
       WHERE ae.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'ALERT_NOT_FOUND',
          message: `No alert found with id: ${id}`,
          status: 404,
        },
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ── STATS (dashboard metrics — last 24 hours) ────────────────
const getAlertStats = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*)                                                    AS total_alerts,
        COUNT(*) FILTER (WHERE event_type = 'ENTER')               AS enter_events,
        COUNT(*) FILTER (WHERE event_type = 'EXIT')                AS exit_events,
        COUNT(*) FILTER (WHERE delivery_status = 'delivered')      AS delivered,
        COUNT(*) FILTER (WHERE delivery_status = 'failed')         AS failed,
        COUNT(*) FILTER (WHERE delivery_status = 'pending')        AS pending,
        COUNT(DISTINCT device_id)                                   AS unique_devices,
        COUNT(DISTINCT fence_id)                                    AS unique_fences
      FROM alert_events
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const stats = result.rows[0];

    res.json({
      period: 'last_24_hours',
      total_alerts:   parseInt(stats.total_alerts, 10),
      events: {
        enter: parseInt(stats.enter_events, 10),
        exit:  parseInt(stats.exit_events, 10),
      },
      delivery: {
        delivered: parseInt(stats.delivered, 10),
        failed:    parseInt(stats.failed, 10),
        pending:   parseInt(stats.pending, 10),
      },
      unique_devices: parseInt(stats.unique_devices, 10),
      unique_fences:  parseInt(stats.unique_fences, 10),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAlerts,
  getAlertById,
  getAlertStats,
};
