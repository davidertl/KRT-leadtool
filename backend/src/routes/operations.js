/**
 * Operations routes — mission phases, op-timer, ROE management
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const PHASE_VALUES = ['planning', 'briefing', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'extraction', 'debrief', 'complete'];
const ROE_VALUES = ['aggressive', 'fire_at_will', 'fire_at_id_target', 'self_defence', 'dnf'];

const createOp = z.object({
  mission_id: z.string().uuid(),
  name: z.string().min(1).max(256),
  description: z.string().max(2000).optional().nullable(),
  roe: z.enum(ROE_VALUES).default('self_defence'),
});

const updateOp = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional().nullable(),
  phase: z.enum(PHASE_VALUES).optional(),
  roe: z.enum(ROE_VALUES).optional(),
  timer_seconds: z.number().int().min(0).optional(),
  timer_running: z.boolean().optional(),
});

/** GET /api/operations?mission_id=... */
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id } = req.query;
    const result = await query(
      `SELECT o.*, u.username AS created_by_name
       FROM operations o
       LEFT JOIN users u ON u.id = o.created_by
       WHERE o.mission_id = $1
       ORDER BY o.created_at DESC`,
      [mission_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** GET /api/operations/:id — single operation */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(`SELECT * FROM operations WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Operation not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/** POST /api/operations */
router.post('/', requireAuth, validate(createOp), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, name, description, roe } = req.body;
    const result = await query(
      `INSERT INTO operations (mission_id, created_by, name, description, roe)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [mission_id, req.user.id, name, description, roe]
    );

    broadcastToMission(mission_id, 'operation:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/** PUT /api/operations/:id */
router.put('/:id', requireAuth, validate(updateOp), async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(req.body)) {
      if (val !== undefined) {
        values.push(val);
        fields.push(`${key} = $${values.length}`);
      }
    }

    // If starting timer, record started_at
    if (req.body.timer_running === true) {
      fields.push('timer_started_at = NOW()');
    }

    // If starting the operation
    if (req.body.phase && req.body.phase !== 'planning') {
      const old = await query(`SELECT started_at FROM operations WHERE id = $1`, [req.params.id]);
      if (old.rows[0] && !old.rows[0].started_at) {
        fields.push('started_at = NOW()');
      }
    }

    // If completing
    if (req.body.phase === 'complete') {
      fields.push('ended_at = NOW()');
    }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);

    const result = await query(
      `UPDATE operations SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Operation not found' });

    broadcastToMission(result.rows[0].mission_id, 'operation:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/** DELETE /api/operations/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM operations WHERE id = $1 RETURNING id, mission_id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Operation not found' });
    broadcastToMission(result.rows[0].mission_id, 'operation:deleted', { id: result.rows[0].id });
    res.json({ message: 'Operation deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
