/**
 * KRT-Leadtool Backend Entry Point
 * Express + Socket.IO + PostgreSQL + Valkey
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocketIO } = require('./socket');
const { testConnection: testDB } = require('./db/postgres');
const { testConnection: testValkey } = require('./db/valkey');

const PORT = process.env.APP_PORT || 3000;

async function start() {
  // Test database connections
  await testDB();
  await testValkey();

  // Create HTTP server and attach Socket.IO
  const server = http.createServer(app);
  initSocketIO(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[KRT] Backend running on port ${PORT}`);
    console.log(`[KRT] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[KRT] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('[KRT] HTTP server closed');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[KRT] Failed to start:', err);
  process.exit(1);
});
