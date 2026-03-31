// src/setupProxy.js — replaces the simple "proxy" string in package.json
// Using explicit middleware means only /api calls are proxied,
// leaving webpack HMR websocket connections untouched.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
    })
  );
};
