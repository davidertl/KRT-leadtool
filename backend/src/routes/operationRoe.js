/**
 * Per-entity ROE override routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { broadcastToMission } = require('../socket');
const { insertEventLog } = require('../helpers/eventLog');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const ROE_VALUES = ['aggressive', 'fire_at_will', 'fire_at_id_target', 'self_defence', 'dnf'];

const upsertRoe = z.object({
  operation_id: z.string().uuid(),
  target_type: z.enum(['unit', 'group', 'person']),
  target_id: z.string().uuid(),
  roe: z.enum(ROE_VALUES),
});

/** GET /api/operation-roe?operation_id=... */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { operation_id } = req.query;
    if (!operation_id) return res.status(400).json({ error: 'operation_id is required' });
    const result = await query(
      `SELECT * FROM operation_roe WHERE operation_id = $1 ORDER BY created_at ASC`,
      [operation_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/operation-roe — upsert (insert or update on conflict) */
router.post('/', requireAuth, validate(upsertRoe), async (req, res, next) => {
  try {
    const { operation_id, target_type, target_id, roe } = req.body;

    // Resolve mission_id
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [operation_id]);
    if (opRes.rows.length === 0) return res.status(404).json({ error: 'Operation not found' });
    const mission_id = opRes.rows[0].mission_id;

    const result = await query(
      `INSERT INTO operation_roe (operation_id, target_type, target_id, roe)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (operation_id, target_type, COALESCE(target_id, '00000000-0000-0000-0000-000000000000'))
       DO UPDATE SET roe = EXCLUDED.roe
       RETURNING *`,
      [operation_id, target_type, target_id, roe]
    );

    broadcastToMission(mission_id, 'operationRoe:updated', result.rows[0]);
    await insertEventLog({ mission_id, operation_id, event_type: 'roe_changed', message: `ROE set to ${roe} for ${target_type} ${target_id}`, user_id: req.user.id });

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/** DELETE /api/operation-roe/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM operation_roe WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'ROE entry not found' });

    const row = result.rows[0];
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [row.operation_id]);
    const mission_id = opRes.rows[0]?.mission_id;
    if (mission_id) {
      broadcastToMission(mission_id, 'operationRoe:deleted', { id: row.id, operation_id: row.operation_id });
    }

    res.json({ message: 'ROE entry deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
