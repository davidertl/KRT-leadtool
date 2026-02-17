/**
 * Sync routes for offline/reconnect delta sync
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireTeamMember } = require('../auth/teamAuth');

/**
 * GET /api/sync?team_id=...&since=ISO8601
 * Returns all changes since a given timestamp for delta sync on reconnect.
 */
router.get('/', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    const { team_id, since } = req.query;
    if (!team_id) return res.status(400).json({ error: 'team_id required' });

    const sinceDate = since ? new Date(since) : new Date(0);

    // Fetch updated units
    const units = await query(
      `SELECT * FROM units WHERE team_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [team_id, sinceDate]
    );

    // Fetch updated groups
    const groups = await query(
      `SELECT * FROM groups WHERE team_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [team_id, sinceDate]
    );

    // Fetch recent history
    const history = await query(
      `SELECT sh.* FROM status_history sh
       JOIN units u ON u.id = sh.unit_id
       WHERE u.team_id = $1 AND sh.changed_at > $2
       ORDER BY sh.changed_at ASC`,
      [team_id, sinceDate]
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
      `SELECT * FROM contacts WHERE team_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [team_id, sinceDate]
    );

    // Fetch updated tasks
    const tasks = await query(
      `SELECT * FROM tasks WHERE team_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
      [team_id, sinceDate]
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
