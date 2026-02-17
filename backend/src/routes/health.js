/**
 * Health check endpoint
 */

const router = require('express').Router();
const { pool } = require('../db/postgres');
const { valkey } = require('../db/valkey');

router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
  };

  // Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    health.services.postgres = 'ok';
  } catch {
    health.services.postgres = 'error';
    health.status = 'degraded';
  }

  // Check Valkey
  try {
    await valkey.ping();
    health.services.valkey = 'ok';
  } catch {
    health.services.valkey = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
