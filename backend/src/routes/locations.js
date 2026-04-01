'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { locationSchema } = require('../utils/validators');
const { processLocation, getDeviceCurrentState } = require('../controllers/locationController');

router.use(auth);

router.post('/:deviceId', validate(locationSchema), processLocation);

// GET /api/v1/locations/:deviceId/state — query current fence membership
router.get('/:deviceId/state', getDeviceCurrentState);

module.exports = router;
