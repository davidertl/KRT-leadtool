/**
 * Battle Plans — war planning and execution routes.
 * Manages battle plans, attack vectors, and group battle-role assignments.
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember, requireGesamtlead } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const BATTLE_STATUSES = ['planning', 'active', 'complete', 'aborted'];
const VECTOR_TYPES = ['attack', 'defense', 'fallback', 'support', 'recon'];
const BATTLE_ROLES = ['assault', 'defense', 'reserve', 'support', 'recon', 'unassigned'];

const createPlanSchema = z.object({
  mission_id: z.string().uuid(),
  name: z.string().min(1).max(256),
  notes: z.string().max(2000).optional().nullable(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  status: z.enum(BATTLE_STATUSES).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const vectorSchema = z.object({
  name: z.string().min(1).max(256),
  vector_type: z.enum(VECTOR_TYPES).default('attack'),
  start_x: z.number(),
  start_y: z.number(),
  start_z: z.number(),
  end_x: z.number(),
  end_y: z.number(),
  end_z: z.number(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ef4444'),
  notes: z.string().max(1000).optional().nullable(),
  sequence: z.number().int().min(0).default(0),
});

/* ─── Plans ─────────────────────────────────────────────── */

/** GET /api/battle-plans?mission_id=X */
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id } = req.query;
    const result = await query(
      `SELECT bp.*, u.username AS created_by_name,
              (SELECT COUNT(*) FROM battle_plan_vectors bpv WHERE bpv.plan_id = bp.id) AS vector_count
       FROM battle_plans bp
       LEFT JOIN users u ON u.id = bp.created_by
       WHERE bp.mission_id = $1
       ORDER BY bp.created_at DESC`,
      [mission_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/battle-plans */
router.post('/', requireAuth, validate(createPlanSchema), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, name, notes } = req.body;
    const result = await query(
      `INSERT INTO battle_plans (mission_id, name, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [mission_id, name, notes || null, req.user.id]
    );
    broadcastToMission(mission_id, 'battleplan:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/** PUT /api/battle-plans/:id */
router.put('/:id', requireAuth, validate(updatePlanSchema), async (req, res, next) => {
  try {
    const existing = await query('SELECT * FROM battle_plans WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Battle plan not found' });
    const plan = existing.rows[0];

    const memberCheck = await query(
      'SELECT mission_role FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [plan.mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member of this mission' });

    const { name, status, notes } = req.body;
    const updated = await query(
      `UPDATE battle_plans SET
         name = COALESCE($1, name),
         status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, status, notes, req.params.id]
    );
    broadcastToMission(plan.mission_id, 'battleplan:updated', updated.rows[0]);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

/** DELETE /api/battle-plans/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await query('SELECT * FROM battle_plans WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Battle plan not found' });
    const plan = existing.rows[0];

    const memberCheck = await query(
      'SELECT mission_role FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [plan.mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member of this mission' });
    if (memberCheck.rows[0].mission_role !== 'gesamtlead') {
      return res.status(403).json({ error: 'Only gesamtlead can delete battle plans' });
    }

    await query('DELETE FROM battle_plans WHERE id = $1', [req.params.id]);
    broadcastToMission(plan.mission_id, 'battleplan:deleted', { id: plan.id, mission_id: plan.mission_id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ─── Vectors ────────────────────────────────────────────── */

/** GET /api/battle-plans/:id/vectors */
router.get('/:id/vectors', requireAuth, async (req, res, next) => {
  try {
    const planResult = await query('SELECT * FROM battle_plans WHERE id = $1', [req.params.id]);
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Battle plan not found' });
    const plan = planResult.rows[0];

    const memberCheck = await query(
      'SELECT 1 FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [plan.mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    const result = await query(
      'SELECT * FROM battle_plan_vectors WHERE plan_id = $1 ORDER BY sequence ASC, created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/battle-plans/:id/vectors */
router.post('/:id/vectors', requireAuth, validate(vectorSchema), async (req, res, next) => {
  try {
    const planResult = await query('SELECT * FROM battle_plans WHERE id = $1', [req.params.id]);
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Battle plan not found' });
    const plan = planResult.rows[0];

    const memberCheck = await query(
      'SELECT mission_role FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [plan.mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    const { name, vector_type, start_x, start_y, start_z, end_x, end_y, end_z, color, notes, sequence } = req.body;
    const result = await query(
      `INSERT INTO battle_plan_vectors
         (plan_id, name, vector_type, start_x, start_y, start_z, end_x, end_y, end_z, color, notes, sequence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.params.id, name, vector_type, start_x, start_y, start_z, end_x, end_y, end_z, color, notes || null, sequence]
    );
    broadcastToMission(plan.mission_id, 'battleplan:vector_added', { plan_id: plan.id, vector: result.rows[0] });
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

/** PUT /api/battle-plans/:planId/vectors/:vectorId */
router.put('/:planId/vectors/:vectorId', requireAuth, validate(vectorSchema.partial()), async (req, res, next) => {
  try {
    const planResult = await query('SELECT * FROM battle_plans WHERE id = $1', [req.params.planId]);
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Battle plan not found' });
    const plan = planResult.rows[0];

    const memberCheck = await query(
      'SELECT mission_role FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [plan.mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    const { name, vector_type, start_x, start_y, start_z, end_x, end_y, end_z, color, notes, sequence } = req.body;
    const result = await query(
      `UPDATE battle_plan_vectors SET
         name = COALESCE($1, name),
         vector_type = COALESCE($2, vector_type),
         start_x = COALESCE($3, start_x),
         start_y = COALESCE($4, start_y),
         start_z = COALESCE($5, start_z),
         end_x = COALESCE($6, end_x),
         end_y = COALESCE($7, end_y),
         end_z = COALESCE($8, end_z),
         color = COALESCE($9, color),
         notes = COALESCE($10, notes),
         sequence = COALESCE($11, sequence)
       WHERE id = $12 AND plan_id = $13 RETURNING *`,
      [name, vector_type, start_x, start_y, start_z, end_x, end_y, end_z, color, notes, sequence, req.params.vectorId, req.params.planId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vector not found' });
    broadcastToMission(plan.mission_id, 'battleplan:vector_updated', { plan_id: plan.id, vector: result.rows[0] });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/** DELETE /api/battle-plans/:planId/vectors/:vectorId */
router.delete('/:planId/vectors/:vectorId', requireAuth, async (req, res, next) => {
  try {
    const planResult = await query('SELECT * FROM battle_plans WHERE id = $1', [req.params.planId]);
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Battle plan not found' });
    const plan = planResult.rows[0];

    const memberCheck = await query(
      'SELECT 1 FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [plan.mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    await query('DELETE FROM battle_plan_vectors WHERE id = $1 AND plan_id = $2', [req.params.vectorId, req.params.planId]);
    broadcastToMission(plan.mission_id, 'battleplan:vector_deleted', { plan_id: plan.id, vector_id: req.params.vectorId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ─── Group Battle Roles ─────────────────────────────────── */

/** POST /api/battle-plans/group-roles  { mission_id, roles: [{group_id, battle_role}] } */
router.post('/group-roles', requireAuth, async (req, res, next) => {
  try {
    const { mission_id, roles } = req.body;
    if (!mission_id || !Array.isArray(roles)) return res.status(400).json({ error: 'mission_id and roles[] required' });

    const memberCheck = await query(
      'SELECT mission_role FROM mission_members WHERE mission_id = $1 AND user_id = $2',
      [mission_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) return res.status(403).json({ error: 'Not a member' });
    if (!['gesamtlead', 'gruppenlead'].includes(memberCheck.rows[0].mission_role)) {
      return res.status(403).json({ error: 'Only gesamtlead or gruppenlead can assign battle roles' });
    }

    const updated = [];
    for (const { group_id, battle_role } of roles) {
      if (!BATTLE_ROLES.includes(battle_role)) continue;
      const result = await query(
        `UPDATE groups SET battle_role = $1, updated_at = NOW()
         WHERE id = $2 AND mission_id = $3 RETURNING *`,
        [battle_role, group_id, mission_id]
      );
      if (result.rows[0]) updated.push(result.rows[0]);
    }

    for (const group of updated) {
      broadcastToMission(mission_id, 'group:updated', group);
    }
    res.json({ updated });
  } catch (err) { next(err); }
});

module.exports = router;
