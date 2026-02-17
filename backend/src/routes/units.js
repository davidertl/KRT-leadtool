/**
 * Units / Ships CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireTeamMember } = require('../auth/teamAuth');
const { broadcastToTeam } = require('../socket');
const { validate } = require('../validation/middleware');
const { schemas } = require('../validation/schemas');

// List units in a team
router.get('/', requireAuth, requireTeamMember, async (req, res, next) => {
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
router.post('/', requireAuth, validate(schemas.createUnit), requireTeamMember, async (req, res, next) => {
  try {
    const { name, callsign, ship_type, unit_type, team_id, group_id, role, crew_count, crew_max,
            pos_x, pos_y, pos_z, heading, fuel, ammo, hull, status, roe, notes } = req.body;
    if (!name || !team_id) return res.status(400).json({ error: 'name and team_id are required' });

    const result = await query(
      `INSERT INTO units (name, callsign, ship_type, unit_type, owner_id, team_id, group_id, role, crew_count, crew_max,
                          pos_x, pos_y, pos_z, heading, fuel, ammo, hull, status, roe, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [name, callsign || null, ship_type || null, unit_type || 'ship', req.user.id, team_id, group_id || null,
       role || null, crew_count || 1, crew_max || null,
       pos_x || 0, pos_y || 0, pos_z || 0, heading || 0,
       fuel ?? 100, ammo ?? 100, hull ?? 100,
       status || 'idle', roe || 'weapons_tight', notes || null]
    );

    broadcastToTeam(team_id, 'unit:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update unit (position, status, group, etc.)
router.put('/:id', requireAuth, validate(schemas.updateUnit), async (req, res, next) => {
  try {
    const { name, callsign, ship_type, unit_type, group_id, role, crew_count, crew_max,
            pos_x, pos_y, pos_z, heading, fuel, ammo, hull, status, roe, notes } = req.body;

    // Fetch old values for history
    const oldResult = await query('SELECT * FROM units WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Unit not found' });
    const oldUnit = oldResult.rows[0];

    // Build dynamic SET clause — only update fields that were explicitly sent
    const fields = [];
    const values = [];
    const bodyFields = { name, callsign, ship_type, unit_type, group_id, role, crew_count, crew_max,
                         pos_x, pos_y, pos_z, heading, fuel, ammo, hull, status, roe, notes };
    for (const [key, val] of Object.entries(bodyFields)) {
      if (val !== undefined) {
        values.push(val);
        fields.push(`${key} = $${values.length}`);
      }
    }
    if (fields.length === 0) return res.json(oldUnit); // nothing to update
    values.push(req.params.id);
    const result = await query(
      `UPDATE units SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
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
router.patch('/batch-position', requireAuth, validate(schemas.batchPosition), async (req, res, next) => {
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
