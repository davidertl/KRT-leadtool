/**
 * Navigation data seeder
 * Runs seed_stanton.sql on startup and on-demand (idempotent via ON CONFLICT DO NOTHING)
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./postgres');

// Possible paths: Docker image (/app/seed/) or local dev (../../postgres/)
const SEED_PATHS = [
  path.resolve(__dirname, '../../seed/seed_stanton.sql'),      // Docker: /app/seed/
  path.resolve(__dirname, '../../../postgres/seed_stanton.sql'), // Local dev
];

/**
 * Read the seed SQL file from the first available path
 * @returns {string|null} SQL content or null if not found
 */
function loadSeedSQL() {
  for (const p of SEED_PATHS) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8');
      }
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Execute the navigation seed SQL against the database.
 * Safe to call on every startup — all INSERTs use ON CONFLICT DO NOTHING.
 */
async function seedNavigation() {
  const sql = loadSeedSQL();
  if (!sql) {
    console.warn('[KRT] Navigation seed file not found — skipping seed');
    return false;
  }

  try {
    await pool.query(sql);
    // Quick count to confirm
    const systems = await pool.query('SELECT count(*)::int AS n FROM star_systems');
    const bodies = await pool.query('SELECT count(*)::int AS n FROM celestial_bodies');
    const points = await pool.query('SELECT count(*)::int AS n FROM navigation_points');
    console.log(
      `[KRT] Navigation seed applied — ${systems.rows[0].n} systems, ${bodies.rows[0].n} bodies, ${points.rows[0].n} nav points`
    );
    return true;
  } catch (err) {
    console.warn('[KRT] Navigation seed failed (non-fatal):', err.message);
    return false;
  }
}

module.exports = { seedNavigation };
