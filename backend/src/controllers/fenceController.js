'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const FENCE_CACHE_KEY = 'fences:active';
const FENCE_CACHE_TTL = parseInt(process.env.FENCE_CACHE_TTL || '300', 10);

async function invalidateCache() {
  await redis.del(FENCE_CACHE_KEY);
  logger.debug('Fence cache invalidated');
}

// ── CREATE ────────────────────────────────────────────────────
const createFence = async (req, res, next) => {
  try {
    const {
      name, description, type,
      center, radius_meters,
      coordinates, events, metadata,
      owner_id, owner_name,
    } = req.body;

    const id = uuidv4();
    const centerLat   = center ? center.lat : null;
    const centerLng   = center ? center.lng : null;
    const radiusM     = radius_meters || null;
    const polygonJson = coordinates ? JSON.stringify(coordinates) : null;

    const result = await db.query(
      `INSERT INTO geo_fences
         (id, name, description, type, center_lat, center_lng, radius_m,
          polygon_json, events, metadata, owner_id, owner_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [id, name, description || null, type, centerLat, centerLng, radiusM,
       polygonJson, events, JSON.stringify(metadata || {}),
       owner_id || null, owner_name || null]
    );

    await invalidateCache();
    logger.info(`Fence created: ${id} (${name}, ${type}, owner: ${owner_id})`);
    res.status(201).json(formatFence(result.rows[0]));
  } catch (err) { next(err); }
};

// ── READ ALL ──────────────────────────────────────────────────
const getAllFences = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    const activeOnly = req.query.active !== 'false';
    const typeFilter = req.query.type;
    const ownerFilter = req.query.owner_id;

    let whereClause = activeOnly ? 'WHERE is_active = TRUE' : 'WHERE 1=1';
    const params = [];

    if (typeFilter) {
      params.push(typeFilter);
      whereClause += ` AND type = $${params.length}`;
    }
    if (ownerFilter) {
      params.push(ownerFilter);
      whereClause += ` AND owner_id = $${params.length}`;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM geo_fences ${whereClause}`, params);
    params.push(limit, offset);
    const dataResult  = await db.query(
      `SELECT * FROM geo_fences ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      fences: dataResult.rows.map(formatFence),
      total:  parseInt(countResult.rows[0].count, 10),
      page, limit,
    });
  } catch (err) { next(err); }
};

// ── READ ONE ──────────────────────────────────────────────────
const getFenceById = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM geo_fences WHERE id = $1', [req.params.fenceId]);
    if (!result.rows.length)
      return res.status(404).json({ error: { code: 'FENCE_NOT_FOUND', message: `No fence found with id: ${req.params.fenceId}`, status: 404 } });
    res.json(formatFence(result.rows[0]));
  } catch (err) { next(err); }
};

// ── UPDATE ────────────────────────────────────────────────────
const updateFence = async (req, res, next) => {
  try {
    const { fenceId } = req.params;
    const { name, description, events, metadata, is_active, owner_name } = req.body;

    const result = await db.query(
      `UPDATE geo_fences
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           events      = COALESCE($3, events),
           metadata    = COALESCE($4, metadata),
           is_active   = COALESCE($5, is_active),
           owner_name  = COALESCE($6, owner_name),
           updated_at  = NOW()
       WHERE id = $7
       RETURNING *`,
      [name||null, description!==undefined?description:null, events||null,
       metadata?JSON.stringify(metadata):null, is_active!==undefined?is_active:null,
       owner_name||null, fenceId]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: { code: 'FENCE_NOT_FOUND', message: `No fence found with id: ${fenceId}`, status: 404 } });

    await invalidateCache();
    res.json(formatFence(result.rows[0]));
  } catch (err) { next(err); }
};

// ── DELETE (soft) ─────────────────────────────────────────────
const deleteFence = async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE geo_fences SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE RETURNING id`,
      [req.params.fenceId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: { code: 'FENCE_NOT_FOUND', message: `No active fence found with id: ${req.params.fenceId}`, status: 404 } });
    await invalidateCache();
    res.json({ message: 'Fence deleted successfully', id: req.params.fenceId });
  } catch (err) { next(err); }
};

// ── FENCE ALERTS ──────────────────────────────────────────────
const getFenceAlerts = async (req, res, next) => {
  try {
    const { fenceId } = req.params;
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10));

    const result = await db.query(
      `SELECT id, device_id, event_type, device_lat, device_lng, delivery_status, created_at
       FROM alert_events
       WHERE fence_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [fenceId, limit]
    );
    res.json({ fence_id: fenceId, alerts: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
};

// ── OWNER STATS ───────────────────────────────────────────────
const getOwnerStats = async (req, res, next) => {
  try {
    // Group fences by owner with event counts
    const result = await db.query(`
      SELECT
        gf.owner_id,
        gf.owner_name,
        COUNT(DISTINCT gf.id)                                         AS fence_count,
        COUNT(ae.id)                                                  AS total_alerts,
        COUNT(ae.id) FILTER (WHERE ae.event_type = 'ENTER')          AS enter_count,
        COUNT(ae.id) FILTER (WHERE ae.event_type = 'EXIT')           AS exit_count,
        MAX(gf.created_at)                                            AS last_fence_created
      FROM geo_fences gf
      LEFT JOIN alert_events ae ON ae.fence_id = gf.id
      WHERE gf.is_active = TRUE AND gf.owner_id IS NOT NULL
      GROUP BY gf.owner_id, gf.owner_name
      ORDER BY fence_count DESC
    `);
    res.json({ owners: result.rows });
  } catch (err) { next(err); }
};

// ── Helper ────────────────────────────────────────────────────
function formatFence(row) {
  const fence = {
    id: row.id, name: row.name, description: row.description,
    type: row.type, events: row.events, is_active: row.is_active,
    metadata: row.metadata || {},
    owner_id: row.owner_id || null, owner_name: row.owner_name || null,
    created_at: row.created_at, updated_at: row.updated_at,
  };
  if (row.type === 'circle') {
    fence.center = { lat: row.center_lat, lng: row.center_lng };
    fence.radius_meters = row.radius_m;
  } else {
    fence.coordinates = typeof row.polygon_json === 'string'
      ? JSON.parse(row.polygon_json) : row.polygon_json;
  }
  return fence;
}

module.exports = { createFence, getAllFences, getFenceById, updateFence, deleteFence, getFenceAlerts, getOwnerStats };
