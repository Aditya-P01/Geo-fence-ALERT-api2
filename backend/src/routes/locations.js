'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { processLocation, getDeviceCurrentState } = require('../controllers/locationController');

router.use(auth);

// POST /api/v1/locations/:deviceId — core detection engine
router.post('/:deviceId', processLocation);

// GET /api/v1/locations/:deviceId/state — query current fence membership
router.get('/:deviceId/state', getDeviceCurrentState);

module.exports = router;
