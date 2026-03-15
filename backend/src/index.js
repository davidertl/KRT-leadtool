/**
 * KRT-Leadtool Backend Entry Point
 * Express + Socket.IO + PostgreSQL + Valkey
 */

require('dotenv').config();

const http = require('http');
const { createApp } = require('./app');
const { initSocketIO } = require('./socket');
const { testConnection: testDB, ensureSchema } = require('./db/postgres');
const { valkey, testConnection: testValkey } = require('./db/valkey');
const { seedNavigation } = require('./db/seed');
const { getEnabledModules } = require('./config/modules');
const { getJwtSecret } = require('./auth/jwt');
const { createVoiceModule } = require('./modules/voice');

const PORT = process.env.APP_PORT || 3000;

async function start() {
  getJwtSecret();
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required');
  }

  const enabledModules = getEnabledModules();

  // Test database connections
  await testDB();
  await testValkey();
  await ensureSchema();

  // Seed navigation data (idempotent — safe on every startup)
  if (enabledModules.includes('leadtool')) {
    await seedNavigation();
  }

  const moduleInstances = [];
  const routeRegistrations = [];

  if (enabledModules.includes('voice')) {
    const voiceModule = createVoiceModule({
      query: require('./db/postgres').query,
      valkey,
    });
    moduleInstances.push(voiceModule);
    routeRegistrations.push(voiceModule.routes());
    routeRegistrations.push(voiceModule.compatibilityRoutes());
  }

  const app = createApp({
    enabledModules,
    extraRouteRegistrations: routeRegistrations,
  });

  // Create HTTP server and attach module transports
  const server = http.createServer(app);
  if (enabledModules.includes('leadtool')) {
    initSocketIO(server);
  }
  for (const moduleInstance of moduleInstances) {
    moduleInstance.init?.();
  }

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    for (const moduleInstance of moduleInstances) {
      if (moduleInstance.handleUpgrade?.(pathname, req, socket, head)) {
        return;
      }
    }
    socket.destroy();
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[KRT] Backend running on port ${PORT}`);
    console.log(`[KRT] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[KRT] Modules: ${enabledModules.join(', ')}`);
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
