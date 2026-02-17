/**
 * Valkey (Redis-compatible) connection
 */

const Redis = require('ioredis');

const valkey = new Redis({
  host: process.env.VALKEY_HOST || 'localhost',
  port: parseInt(process.env.VALKEY_PORT || '6379', 10),
  password: process.env.VALKEY_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: true,
});

valkey.on('error', (err) => {
  console.error('[KRT] Valkey error:', err.message);
});

valkey.on('connect', () => {
  console.log('[KRT] Valkey connected');
});

async function testConnection() {
  await valkey.connect();
  const pong = await valkey.ping();
  console.log('[KRT] Valkey ping:', pong);
}

module.exports = { valkey, testConnection };
