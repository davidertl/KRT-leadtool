/**
 * Missions / Projects CRUD routes
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

// List missions the user belongs to
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.*, mm.role AS member_role, mm.mission_role, mm.assigned_group_ids
       FROM missions m
       JOIN mission_members mm ON mm.mission_id = m.id
       WHERE mm.user_id = $1
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Get single mission
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.*, mm.role AS member_role, mm.mission_role, mm.assigned_group_ids
       FROM missions m
       JOIN mission_members mm ON mm.mission_id = m.id
       WHERE m.id = $1 AND mm.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Mission not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Create mission
router.post('/', requireAuth, validate(schemas.createMission), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const joinCode = generateJoinCode();
    const result = await query(
      `INSERT INTO missions (name, description, owner_id, join_code, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description || null, req.user.id, joinCode, settings || {}]
    );

    // Add creator as admin + gesamtlead
    await query(
      `INSERT INTO mission_members (mission_id, user_id, role, mission_role) VALUES ($1, $2, 'admin', 'gesamtlead')`,
      [result.rows[0].id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update mission
router.put('/:id', requireAuth, validate(schemas.updateMission), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;
    const result = await query(
      `UPDATE missions SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         settings = COALESCE($3, settings)
       WHERE id = $4 AND owner_id = $5
       RETURNING *`,
      [name, description, settings, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Mission not found or unauthorized' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Delete mission
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM missions WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Mission not found or unauthorized' });
    res.json({ message: 'Mission deleted' });
  } catch (err) { next(err); }
});

// Add member to mission
router.post('/:id/members', requireAuth, async (req, res, next) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    await query(
      `INSERT INTO mission_members (mission_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (mission_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [req.params.id, user_id, role || 'member']
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) { next(err); }
});

module.exports = router;
