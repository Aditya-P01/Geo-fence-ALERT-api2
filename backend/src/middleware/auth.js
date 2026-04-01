'use strict';

const crypto = require('crypto');

/**
 * API Key Authentication Middleware
 *
 * Expects: Authorization: Bearer <API_KEY>
 * Returns 401 if header is missing or token is invalid.
 */
const auth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
        status: 401,
      },
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'API_KEY not configured',
        status: 500,
      },
    });
  }

  const a = Buffer.from(token);
  const b = Buffer.from(expectedKey);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
        status: 401,
      },
    });
  }

  next();
};

module.exports = auth;
