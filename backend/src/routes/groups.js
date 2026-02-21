/**
 * Groups / Fleets CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { validate } = require('../validation/middleware');
const { schemas } = require('../validation/schemas');

// List groups in a mission
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id } = req.query;
    if (!mission_id) return res.status(400).json({ error: 'mission_id query parameter required' });

    const result = await query(
      `SELECT g.*,
              COALESCE(COUNT(u.id), 0)::int AS unit_count
       FROM groups g
       LEFT JOIN units u ON u.group_id = g.id
       WHERE g.mission_id = $1
       GROUP BY g.id
       ORDER BY g.name ASC`,
      [mission_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Create group
router.post('/', requireAuth, validate(schemas.createGroup), requireMissionMember, async (req, res, next) => {
  try {
    const { name, mission_id, class_type, color, icon } = req.body;
    if (!name || !mission_id) return res.status(400).json({ error: 'name and mission_id are required' });

    const result = await query(
      `INSERT INTO groups (name, mission_id, class_type, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, mission_id, class_type || 'CUSTOM', color || '#3B82F6', icon || 'default']
    );

    broadcastToMission(mission_id, 'group:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update group
router.put('/:id', requireAuth, validate(schemas.updateGroup), async (req, res, next) => {
  try {
    const { name, class_type, color, icon } = req.body;

    const result = await query(
      `UPDATE groups SET
         name = COALESCE($1, name),
         class_type = COALESCE($2, class_type),
         color = COALESCE($3, color),
         icon = COALESCE($4, icon)
       WHERE id = $5
       RETURNING *`,
      [name, class_type, color, icon, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });

    broadcastToMission(result.rows[0].mission_id, 'group:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Delete group
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM groups WHERE id = $1 RETURNING id, mission_id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });

    broadcastToMission(result.rows[0].mission_id, 'group:deleted', { id: result.rows[0].id });
    res.json({ message: 'Group deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
