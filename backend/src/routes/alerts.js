'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAllAlerts, getAlertById, getAlertStats } = require('../controllers/alertController');

router.use(auth);

// GET /api/v1/alerts/stats — metrics for last 24h (must be before /:id)
router.get('/stats', getAlertStats);

// GET /api/v1/alerts — list with filters & pagination
router.get('/', getAllAlerts);

// GET /api/v1/alerts/:id — single alert
router.get('/:id', getAlertById);

module.exports = router;
