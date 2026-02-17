/**
 * Status history routes (audit log, undo support)
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { broadcastToTeam } = require('../socket');

// Get history for a unit
router.get('/:unit_id', requireAuth, async (req, res, next) => {
  try {
    const { limit } = req.query;
    const result = await query(
      `SELECT sh.*, u2.username AS changed_by_name
       FROM status_history sh
       LEFT JOIN users u2 ON u2.id = sh.changed_by
       WHERE sh.unit_id = $1
       ORDER BY sh.changed_at DESC
       LIMIT $2`,
      [req.params.unit_id, parseInt(limit) || 50]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Undo last change for a unit
router.post('/:unit_id/undo', requireAuth, async (req, res, next) => {
  try {
    // Get the most recent history entry
    const histResult = await query(
      `SELECT * FROM status_history
       WHERE unit_id = $1
       ORDER BY changed_at DESC
       LIMIT 1`,
      [req.params.unit_id]
    );

    if (histResult.rows.length === 0) {
      return res.status(404).json({ error: 'No history to undo' });
    }

    const entry = histResult.rows[0];
    const oldValue = JSON.parse(entry.old_value);

    // Whitelist allowed fields to prevent SQL injection
    const ALLOWED_FIELDS = ['status', 'group_id', 'pos_x', 'pos_y', 'pos_z', 'heading', 'name', 'ship_type', 'notes'];
    if (!ALLOWED_FIELDS.includes(entry.field_changed)) {
      return res.status(400).json({ error: 'Cannot revert this field' });
    }

    // Revert the field
    const revertResult = await query(
      `UPDATE units SET ${entry.field_changed} = $1 WHERE id = $2 RETURNING *`,
      [oldValue, req.params.unit_id]
    );

    // Remove the history entry (consumed)
    await query('DELETE FROM status_history WHERE id = $1', [entry.id]);

    if (revertResult.rows[0]) {
      broadcastToTeam(revertResult.rows[0].team_id, 'unit:updated', revertResult.rows[0]);
    }

    res.json({
      message: `Reverted ${entry.field_changed}`,
      unit: revertResult.rows[0],
    });
  } catch (err) { next(err); }
});

module.exports = router;
