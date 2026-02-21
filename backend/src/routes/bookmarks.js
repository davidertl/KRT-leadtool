/**
 * Bookmarks routes — saved map locations
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const createBookmark = z.object({
  mission_id: z.string().uuid(),
  name: z.string().min(1).max(256),
  pos_x: z.number().finite(),
  pos_y: z.number().finite(),
  pos_z: z.number().finite(),
  zoom: z.number().finite().optional(),
  icon: z.string().max(64).optional(),
  is_shared: z.boolean().optional(),
});

/** GET /api/bookmarks?mission_id=... */
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id } = req.query;
    const result = await query(
      `SELECT b.*, u.username AS created_by_name
       FROM bookmarks b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.mission_id = $1
         AND (b.is_shared = true OR b.user_id = $2)
       ORDER BY b.name ASC`,
      [mission_id, req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/bookmarks */
router.post('/', requireAuth, validate(createBookmark), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, name, pos_x, pos_y, pos_z, zoom, icon, is_shared } = req.body;
    const result = await query(
      `INSERT INTO bookmarks (mission_id, user_id, name, pos_x, pos_y, pos_z, zoom, icon, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [mission_id, req.user.id, name, pos_x, pos_y, pos_z, zoom || 500, icon || '📌', is_shared || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/** PUT /api/bookmarks/:id */
router.put('/:id', requireAuth, validate(
  z.object({
    name: z.string().min(1).max(256).optional(),
    pos_x: z.number().finite().optional(),
    pos_y: z.number().finite().optional(),
    pos_z: z.number().finite().optional(),
    zoom: z.number().finite().optional(),
    icon: z.string().max(64).optional(),
    is_shared: z.boolean().optional(),
  })
), async (req, res, next) => {
  try {
    const { name, pos_x, pos_y, pos_z, zoom, icon, is_shared } = req.body;
    const result = await query(
      `UPDATE bookmarks SET
         name = COALESCE($1, name),
         pos_x = COALESCE($2, pos_x),
         pos_y = COALESCE($3, pos_y),
         pos_z = COALESCE($4, pos_z),
         zoom = COALESCE($5, zoom),
         icon = COALESCE($6, icon),
         is_shared = COALESCE($7, is_shared)
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [name, pos_x, pos_y, pos_z, zoom, icon, is_shared, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bookmark not found or unauthorized' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/** DELETE /api/bookmarks/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query(`DELETE FROM bookmarks WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
