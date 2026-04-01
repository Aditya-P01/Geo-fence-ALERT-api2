'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { fenceSchema, fenceUpdateSchema } = require('../utils/validators');
const {
  createFence, getAllFences, getFenceById,
  updateFence, deleteFence,
  getFenceAlerts, getOwnerStats,
} = require('../controllers/fenceController');

router.use(auth);

router.get('/',                  getAllFences);
router.post('/',                 validate(fenceSchema), createFence);
router.get('/owners/stats',      getOwnerStats);           // NEW — owner summary
router.get('/:fenceId',          getFenceById);
router.put('/:fenceId',          validate(fenceUpdateSchema), updateFence);
router.delete('/:fenceId',       deleteFence);
router.get('/:fenceId/alerts',   getFenceAlerts);          // NEW — fence event history

module.exports = router;
