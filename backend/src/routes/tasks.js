/**
 * Tasks / Orders CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { validate } = require('../validation/middleware');
const { z } = require('zod');

const PRIORITY_VALUES = ['low', 'normal', 'high', 'critical'];
const STATUS_VALUES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
const TASK_TYPE_VALUES = ['custom', 'escort', 'intercept', 'recon', 'pickup', 'dropoff', 'hold', 'patrol', 'screen', 'qrf', 'rescue', 'repair', 'refuel', 'medevac', 'supply_run'];
const ROE_VALUES = ['aggressive', 'fire_at_will', 'fire_at_id_target', 'self_defence', 'dnf'];

const createTask = z.object({
  mission_id: z.string().uuid(),
  title: z.string().min(1).max(256),
  description: z.string().max(2000).optional().nullable(),
  task_type: z.enum(TASK_TYPE_VALUES).default('custom'),
  priority: z.enum(PRIORITY_VALUES).default('normal'),
  roe: z.enum(ROE_VALUES).default('self_defence'),
  assigned_to: z.string().uuid().optional().nullable(),
  assigned_group: z.string().uuid().optional().nullable(),
  target_x: z.number().finite().optional().nullable(),
  target_y: z.number().finite().optional().nullable(),
  target_z: z.number().finite().optional().nullable(),
  target_contact: z.string().uuid().optional().nullable(),
  start_at: z.string().datetime().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  depends_on: z.string().uuid().optional().nullable(),
});

const updateTask = z.object({
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional().nullable(),
  task_type: z.enum(TASK_TYPE_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  roe: z.enum(ROE_VALUES).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  assigned_group: z.string().uuid().optional().nullable(),
  target_x: z.number().finite().optional().nullable(),
  target_y: z.number().finite().optional().nullable(),
  target_z: z.number().finite().optional().nullable(),
  target_contact: z.string().uuid().optional().nullable(),
  start_at: z.string().datetime().optional().nullable(),
  due_at: z.string().datetime().optional().nullable(),
  depends_on: z.string().uuid().optional().nullable(),
});

// List tasks for a mission
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, status, assigned_to } = req.query;
    let sql = `SELECT t.*,
                 u_created.username AS created_by_name,
                 u_unit.name AS assigned_unit_name,
                 g.name AS assigned_group_name
               FROM tasks t
               LEFT JOIN users u_created ON u_created.id = t.created_by
               LEFT JOIN units u_unit ON u_unit.id = t.assigned_to
               LEFT JOIN groups g ON g.id = t.assigned_group
               WHERE t.mission_id = $1`;
    const params = [mission_id];

    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }
    if (assigned_to) {
      params.push(assigned_to);
      sql += ` AND t.assigned_to = $${params.length}`;
    }

    sql += ' ORDER BY CASE t.priority WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 WHEN \'low\' THEN 3 END, t.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Create task
router.post('/', requireAuth, validate(createTask), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, title, description, task_type, priority, roe, assigned_to, assigned_group, target_x, target_y, target_z, target_contact, start_at, due_at, depends_on } = req.body;

    // If assigned, set status to 'assigned'
    const status = (assigned_to || assigned_group) ? 'assigned' : 'pending';

    const result = await query(
      `INSERT INTO tasks (mission_id, created_by, title, description, task_type, priority, status, roe, assigned_to, assigned_group, target_x, target_y, target_z, target_contact, start_at, due_at, depends_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [mission_id, req.user.id, title, description, task_type || 'custom', priority, status, roe || 'self_defence', assigned_to, assigned_group, target_x, target_y, target_z, target_contact, start_at, due_at, depends_on]
    );

    broadcastToMission(mission_id, 'task:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update task
router.put('/:id', requireAuth, validate(updateTask), async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(req.body)) {
      if (val !== undefined) {
        values.push(val);
        fields.push(`${key} = $${values.length}`);
      }
    }

    // Auto-set completed_at when status changes to completed
    if (req.body.status === 'completed') {
      fields.push('completed_at = NOW()');
    }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);

    const result = await query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    broadcastToMission(result.rows[0].mission_id, 'task:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Delete task
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id, mission_id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    broadcastToMission(result.rows[0].mission_id, 'task:deleted', { id: result.rows[0].id });
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
