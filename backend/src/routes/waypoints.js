/**
 * Waypoints CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { broadcastToMission } = require('../socket');
const { validate } = require('../validation/middleware');
const { schemas } = require('../validation/schemas');

// List waypoints for a unit
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { unit_id } = req.query;
    if (!unit_id) return res.status(400).json({ error: 'unit_id query parameter required' });

    const result = await query(
      `SELECT w.*, u.mission_id
       FROM waypoints w
       JOIN units u ON u.id = w.unit_id
       WHERE w.unit_id = $1
       ORDER BY w.sequence ASC`,
      [unit_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Create waypoint
router.post('/', requireAuth, validate(schemas.createWaypoint), async (req, res, next) => {
  try {
    const { unit_id, pos_x, pos_y, pos_z, sequence, label } = req.body;
    if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

    // Auto-calculate sequence if not provided
    let seq = sequence;
    if (seq === undefined) {
      const maxSeq = await query(
        'SELECT COALESCE(MAX(sequence), -1) + 1 AS next_seq FROM waypoints WHERE unit_id = $1',
        [unit_id]
      );
      seq = maxSeq.rows[0].next_seq;
    }

    const result = await query(
      `INSERT INTO waypoints (unit_id, pos_x, pos_y, pos_z, sequence, label, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [unit_id, pos_x || 0, pos_y || 0, pos_z || 0, seq, label || null, req.user.id]
    );

    // Get mission_id for broadcast
    const unit = await query('SELECT mission_id FROM units WHERE id = $1', [unit_id]);
    if (unit.rows[0]) {
      broadcastToMission(unit.rows[0].mission_id, 'waypoint:created', result.rows[0]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Delete waypoint
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM waypoints WHERE id = $1
       RETURNING id, unit_id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Waypoint not found' });

    const unit = await query('SELECT mission_id FROM units WHERE id = $1', [result.rows[0].unit_id]);
    if (unit.rows[0]) {
      broadcastToMission(unit.rows[0].mission_id, 'waypoint:deleted', { id: result.rows[0].id });
    }

    res.json({ message: 'Waypoint deleted' });
  } catch (err) { next(err); }
});

// Clear all waypoints for a unit
router.delete('/unit/:unit_id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM waypoints WHERE unit_id = $1', [req.params.unit_id]);

    const unit = await query('SELECT mission_id FROM units WHERE id = $1', [req.params.unit_id]);
    if (unit.rows[0]) {
      broadcastToMission(unit.rows[0].mission_id, 'waypoints:cleared', { unit_id: req.params.unit_id });
    }

    res.json({ message: 'Waypoints cleared' });
  } catch (err) { next(err); }
});

module.exports = router;
