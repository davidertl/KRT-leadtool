/**
 * Sync routes for offline/reconnect delta sync
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');

/**
 * GET /api/sync?mission_id=...&since=ISO8601
 * Returns all changes since a given timestamp for delta sync on reconnect.
 */
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, since } = req.query;
    if (!mission_id) return res.status(400).json({ error: 'mission_id required' });

    const sinceDate = since ? new Date(since) : new Date(0);

    // Fetch updated units
    const units = await query(
      `SELECT * FROM units WHERE mission_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [mission_id, sinceDate]
    );

    // Fetch updated groups
    const groups = await query(
      `SELECT * FROM groups WHERE mission_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [mission_id, sinceDate]
    );

    // Fetch recent history
    const history = await query(
      `SELECT sh.* FROM status_history sh
       JOIN units u ON u.id = sh.unit_id
       WHERE u.mission_id = $1 AND sh.changed_at > $2
       ORDER BY sh.changed_at ASC`,
      [mission_id, sinceDate]
    );

    // Fetch waypoints for updated units
    const unitIds = units.rows.map((u) => u.id);
    let waypoints = { rows: [] };
    if (unitIds.length > 0) {
      waypoints = await query(
        `SELECT * FROM waypoints WHERE unit_id = ANY($1) ORDER BY sequence ASC`,
        [unitIds]
      );
    }

    // Fetch updated contacts
    const contacts = await query(
      `SELECT * FROM contacts WHERE mission_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [mission_id, sinceDate]
    );

    // Fetch updated tasks
    const tasks = await query(
      `SELECT * FROM tasks WHERE mission_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [mission_id, sinceDate]
    );

    res.json({
      server_time: new Date().toISOString(),
      units: units.rows,
      groups: groups.rows,
      waypoints: waypoints.rows,
      history: history.rows,
      contacts: contacts.rows,
      tasks: tasks.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
