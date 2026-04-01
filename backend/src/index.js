'use strict';

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const healthRouter = require('./routes/health');
const fencesRouter = require('./routes/fences');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
});

// Export io so controllers can emit events
app.set('io', io);

// ── Security & Utility Middleware ──────────────────────────────
const rateLimit = require('express-rate-limit');

// Security Finding #4: Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later', status: 429 } },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use(helmet({ contentSecurityPolicy: false }));

// Security Finding #5: CORS Policy too open
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Security Finding #2: Bearer token leaked in logs
app.use((req, res, next) => {
  const originalInfo = logger.info;
  // Redact authorization header if logging the request
  if (req.headers.authorization) {
    // Note: Morgan format 'combined' already logs some info, 
    // but custom logs might dump the whole request object.
  }
  next();
});

app.use(morgan('combined', {
  stream: { write: msg => {
    // Redact Bearer tokens from morgan logs
    const redacted = msg.replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]');
    logger.info(redacted.trim());
  } }
}));

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/fences', fencesRouter);
app.use('/api/v1/locations', require('./routes/locations'));
app.use('/api/v1/alerts', require('./routes/alerts'));
app.use('/api/v1/webhooks', require('./routes/webhooks'));

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found`, status: 404 }
  });
});

// ── Global Error Handler ───────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Geo-Fence Alert API running on port ${PORT}`);
  logger.info(`🔌 Socket.IO listening on port ${PORT}`);
});

// ── Graceful Shutdown ──────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      const db = require('./config/db');
      const redis = require('./config/redis');
      await db.pool.end();
      await redis.quit();
      logger.info('Connections closed. Bye!');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app; // for testing
