/**
 * Operation Phases CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { insertEventLog } = require('../helpers/eventLog');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const PHASE_TYPE_VALUES = ['planning', 'briefing', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'extraction', 'debrief', 'custom'];

const createPhase = z.object({
  operation_id: z.string().uuid(),
  name: z.string().min(1).max(256),
  phase_type: z.enum(PHASE_TYPE_VALUES).default('custom'),
  sort_order: z.number().int().min(0).default(0),
  planned_start: z.string().datetime().optional().nullable(),
  planned_end: z.string().datetime().optional().nullable(),
});

const updatePhase = z.object({
  name: z.string().min(1).max(256).optional(),
  phase_type: z.enum(PHASE_TYPE_VALUES).optional(),
  sort_order: z.number().int().min(0).optional(),
  planned_start: z.string().datetime().optional().nullable(),
  planned_end: z.string().datetime().optional().nullable(),
  actual_start: z.string().datetime().optional().nullable(),
  actual_end: z.string().datetime().optional().nullable(),
});

/** GET /api/operation-phases?operation_id=... */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { operation_id } = req.query;
    if (!operation_id) return res.status(400).json({ error: 'operation_id is required' });
    const result = await query(
      `SELECT * FROM operation_phases WHERE operation_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [operation_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/operation-phases */
router.post('/', requireAuth, validate(createPhase), async (req, res, next) => {
  try {
    const { operation_id, name, phase_type, sort_order, planned_start, planned_end } = req.body;

    // Look up mission_id from operation
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [operation_id]);
    if (opRes.rows.length === 0) return res.status(404).json({ error: 'Operation not found' });
    const mission_id = opRes.rows[0].mission_id;

    const result = await query(
      `INSERT INTO operation_phases (operation_id, name, phase_type, sort_order, planned_start, planned_end)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [operation_id, name, phase_type, sort_order, planned_start || null, planned_end || null]
    );

    broadcastToMission(mission_id, 'operationPhase:created', result.rows[0]);
    await insertEventLog({ mission_id, operation_id, event_type: 'phase_created', message: `Phase "${name}" added`, user_id: req.user.id });

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/** PUT /api/operation-phases/:id */
router.put('/:id', requireAuth, validate(updatePhase), async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(req.body)) {
      if (val !== undefined) {
        values.push(val);
        fields.push(`${key} = $${values.length}`);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);

    const result = await query(
      `UPDATE operation_phases SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Phase not found' });

    const phase = result.rows[0];
    // Look up mission_id
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [phase.operation_id]);
    const mission_id = opRes.rows[0]?.mission_id;
    if (mission_id) {
      broadcastToMission(mission_id, 'operationPhase:updated', phase);
      await insertEventLog({ mission_id, operation_id: phase.operation_id, event_type: 'phase_updated', message: `Phase "${phase.name}" updated`, user_id: req.user.id });
    }

    res.json(phase);
  } catch (err) { next(err); }
});

/** DELETE /api/operation-phases/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM operation_phases WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Phase not found' });

    const phase = result.rows[0];
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [phase.operation_id]);
    const mission_id = opRes.rows[0]?.mission_id;
    if (mission_id) {
      broadcastToMission(mission_id, 'operationPhase:deleted', { id: phase.id, operation_id: phase.operation_id });
      await insertEventLog({ mission_id, operation_id: phase.operation_id, event_type: 'phase_deleted', message: `Phase "${phase.name}" removed`, user_id: req.user.id });
    }

    res.json({ message: 'Phase deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
