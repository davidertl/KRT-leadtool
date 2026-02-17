/**
 * Groups / Fleets CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { broadcastToTeam } = require('../socket');

// List groups in a team
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { team_id } = req.query;
    if (!team_id) return res.status(400).json({ error: 'team_id query parameter required' });

    const result = await query(
      `SELECT g.*,
              COALESCE(COUNT(u.id), 0)::int AS unit_count
       FROM groups g
       LEFT JOIN units u ON u.group_id = g.id
       WHERE g.team_id = $1
       GROUP BY g.id
       ORDER BY g.name ASC`,
      [team_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Create group
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, team_id, mission, color, icon } = req.body;
    if (!name || !team_id) return res.status(400).json({ error: 'name and team_id are required' });

    const result = await query(
      `INSERT INTO groups (name, team_id, mission, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, team_id, mission || 'CUSTOM', color || '#3B82F6', icon || 'default']
    );

    broadcastToTeam(team_id, 'group:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update group
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, mission, color, icon } = req.body;

    const result = await query(
      `UPDATE groups SET
         name = COALESCE($1, name),
         mission = COALESCE($2, mission),
         color = COALESCE($3, color),
         icon = COALESCE($4, icon)
       WHERE id = $5
       RETURNING *`,
      [name, mission, color, icon, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });

    broadcastToTeam(result.rows[0].team_id, 'group:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Delete group
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM groups WHERE id = $1 RETURNING id, team_id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });

    broadcastToTeam(result.rows[0].team_id, 'group:deleted', { id: result.rows[0].id });
    res.json({ message: 'Group deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
