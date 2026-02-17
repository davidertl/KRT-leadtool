/**
 * Units / Ships CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { broadcastToTeam } = require('../socket');

// List units in a team
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { team_id, group_id, status } = req.query;
    if (!team_id) return res.status(400).json({ error: 'team_id query parameter required' });

    let sql = `SELECT u.*, g.name AS group_name, g.mission AS group_mission, g.color AS group_color
               FROM units u
               LEFT JOIN groups g ON g.id = u.group_id
               WHERE u.team_id = $1`;
    const params = [team_id];

    if (group_id) {
      params.push(group_id);
      sql += ` AND u.group_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND u.status = $${params.length}`;
    }

    sql += ' ORDER BY u.name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Get single unit
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.*, g.name AS group_name, g.mission AS group_mission
       FROM units u
       LEFT JOIN groups g ON g.id = u.group_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Create unit
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, ship_type, team_id, group_id, pos_x, pos_y, pos_z, heading, status, notes } = req.body;
    if (!name || !team_id) return res.status(400).json({ error: 'name and team_id are required' });

    const result = await query(
      `INSERT INTO units (name, ship_type, owner_id, team_id, group_id, pos_x, pos_y, pos_z, heading, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, ship_type || null, req.user.id, team_id, group_id || null,
       pos_x || 0, pos_y || 0, pos_z || 0, heading || 0, status || 'idle', notes || null]
    );

    broadcastToTeam(team_id, 'unit:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update unit (position, status, group, etc.)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, ship_type, group_id, pos_x, pos_y, pos_z, heading, status, notes } = req.body;

    // Fetch old values for history
    const oldResult = await query('SELECT * FROM units WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    const oldUnit = oldResult.rows[0];

    const result = await query(
      `UPDATE units SET
         name = COALESCE($1, name),
         ship_type = COALESCE($2, ship_type),
         group_id = COALESCE($3, group_id),
         pos_x = COALESCE($4, pos_x),
         pos_y = COALESCE($5, pos_y),
         pos_z = COALESCE($6, pos_z),
         heading = COALESCE($7, heading),
         status = COALESCE($8, status),
         notes = COALESCE($9, notes)
       WHERE id = $10
       RETURNING *`,
      [name, ship_type, group_id, pos_x, pos_y, pos_z, heading, status, notes, req.params.id]
    );

    const newUnit = result.rows[0];

    // Record changes in status_history
    const fieldsToTrack = ['status', 'group_id', 'pos_x', 'pos_y', 'pos_z'];
    for (const field of fieldsToTrack) {
      if (req.body[field] !== undefined && String(oldUnit[field]) !== String(newUnit[field])) {
        await query(
          `INSERT INTO status_history (unit_id, field_changed, old_value, new_value, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, field, JSON.stringify(oldUnit[field]), JSON.stringify(newUnit[field]), req.user.id]
        );
      }
    }

    broadcastToTeam(newUnit.team_id, 'unit:updated', newUnit);
    res.json(newUnit);
  } catch (err) { next(err); }
});

// Delete unit
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM units WHERE id = $1 RETURNING id, team_id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });

    broadcastToTeam(result.rows[0].team_id, 'unit:deleted', { id: result.rows[0].id });
    res.json({ message: 'Unit deleted' });
  } catch (err) { next(err); }
});

// Batch update positions (for drag & drop multiple units)
router.patch('/batch-position', requireAuth, async (req, res, next) => {
  try {
    const { updates } = req.body; // [{ id, pos_x, pos_y, pos_z, heading }]
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' });
    }

    const results = [];
    for (const u of updates) {
      const result = await query(
        `UPDATE units SET pos_x = $1, pos_y = $2, pos_z = $3, heading = COALESCE($4, heading)
         WHERE id = $5 RETURNING *`,
        [u.pos_x, u.pos_y, u.pos_z, u.heading, u.id]
      );
      if (result.rows[0]) {
        results.push(result.rows[0]);
        broadcastToTeam(result.rows[0].team_id, 'unit:updated', result.rows[0]);
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});

module.exports = router;
