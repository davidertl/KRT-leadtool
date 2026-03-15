/**
 * PostgreSQL connection pool
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'krt_user',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'krt_leadtool',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[KRT] PostgreSQL pool error:', err.message);
});

async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() AS now');
    console.log('[KRT] PostgreSQL connected:', result.rows[0].now);
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE mission_members
      ADD COLUMN IF NOT EXISTS assigned_unit_ids UUID[] DEFAULT '{}'
    `);
    await client.query(`
      ALTER TABLE mission_members
      ADD COLUMN IF NOT EXISTS primary_unit_id UUID REFERENCES units(id) ON DELETE SET NULL
    `);
    await client.query(`
      UPDATE mission_members
      SET assigned_unit_ids = '{}'
      WHERE assigned_unit_ids IS NULL
    `);
    await client.query(`
      ALTER TABLE quick_messages
      ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'web'
    `);
    await client.query(`
      UPDATE missions
      SET settings = COALESCE(settings, '{}'::jsonb) || '{"companion_status_sync_enabled": true}'::jsonb
      WHERE settings IS NULL OR NOT (settings ? 'companion_status_sync_enabled')
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS companion_sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        session_name VARCHAR(128),
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_sessions_token_hash
      ON companion_sessions(token_hash)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companion_sessions_user
      ON companion_sessions(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_companion_sessions_active
      ON companion_sessions(user_id, revoked_at, expires_at)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_sessions (
        session_token_hash TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(128),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_freq_listeners (
        session_token_hash TEXT NOT NULL REFERENCES voice_sessions(session_token_hash) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        freq_id INTEGER NOT NULL,
        radio_slot INTEGER DEFAULT 0,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (session_token_hash, freq_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_freq_listeners_freq
      ON voice_freq_listeners(freq_id)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_tx_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        freq_id INTEGER NOT NULL,
        radio_slot INTEGER,
        action VARCHAR(16) NOT NULL CHECK (action IN ('start', 'stop')),
        source VARCHAR(16) NOT NULL DEFAULT 'companion',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_tx_events_time
      ON voice_tx_events(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_voice_tx_events_freq
      ON voice_tx_events(freq_id, created_at DESC)
    `);
  } finally {
    client.release();
  }
}

/**
 * Execute a query with parameterized values
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[KRT] Query:', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }
  return result;
}

module.exports = { pool, query, testConnection, ensureSchema };
