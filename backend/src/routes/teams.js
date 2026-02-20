/**
 * Teams / Projects CRUD routes
 */

const router = require('express').Router();
const crypto = require('crypto');
const { query } = require('../db/postgres');
const { requireAuth, requireRole } = require('../auth/jwt');
const { validate } = require('../validation/middleware');
const { schemas } = require('../validation/schemas');

/** Generate a short random join code */
function generateJoinCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex
}

// List teams the user belongs to
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*, tm.role AS member_role, tm.mission_role, tm.assigned_group_ids
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Get single team
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*, tm.role AS member_role, tm.mission_role, tm.assigned_group_ids
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE t.id = $1 AND tm.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Create team
router.post('/', requireAuth, validate(schemas.createTeam), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const joinCode = generateJoinCode();
    const result = await query(
      `INSERT INTO teams (name, description, owner_id, join_code, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description || null, req.user.id, joinCode, settings || {}]
    );

    // Add creator as admin + gesamtlead
    await query(
      `INSERT INTO team_members (team_id, user_id, role, mission_role) VALUES ($1, $2, 'admin', 'gesamtlead')`,
      [result.rows[0].id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update team
router.put('/:id', requireAuth, validate(schemas.updateTeam), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;
    const result = await query(
      `UPDATE teams SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         settings = COALESCE($3, settings)
       WHERE id = $4 AND owner_id = $5
       RETURNING *`,
      [name, description, settings, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found or unauthorized' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Delete team
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM teams WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found or unauthorized' });
    res.json({ message: 'Team deleted' });
  } catch (err) { next(err); }
});

// Add member to team
router.post('/:id/members', requireAuth, async (req, res, next) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    await query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, user_id, role || 'member']
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) { next(err); }
});

module.exports = router;
