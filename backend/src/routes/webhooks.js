'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  registerWebhook,
  getAllWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
} = require('../controllers/webhookController');

router.use(auth);

router.get('/',    getAllWebhooks);
router.post('/',   registerWebhook);
router.get('/:id', getWebhookById);
router.put('/:id', updateWebhook);
router.delete('/:id', deleteWebhook);

module.exports = router;
