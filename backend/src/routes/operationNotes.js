/**
 * Operation Notes / Debrief notes routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { broadcastToMission } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const createNote = z.object({
  operation_id: z.string().uuid(),
  phase_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  content: z.string().min(1).max(4000),
});

const updateNote = z.object({
  content: z.string().min(1).max(4000).optional(),
  phase_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
});

/** GET /api/operation-notes?operation_id=...&phase_id=...&task_id=... */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { operation_id, phase_id, task_id } = req.query;
    if (!operation_id) return res.status(400).json({ error: 'operation_id is required' });

    let sql = `SELECT n.*, u.username AS created_by_name
               FROM operation_notes n
               LEFT JOIN users u ON u.id = n.created_by
               WHERE n.operation_id = $1`;
    const params = [operation_id];

    if (phase_id) {
      params.push(phase_id);
      sql += ` AND n.phase_id = $${params.length}`;
    }
    if (task_id) {
      params.push(task_id);
      sql += ` AND n.task_id = $${params.length}`;
    }

    sql += ' ORDER BY n.created_at ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/operation-notes */
router.post('/', requireAuth, validate(createNote), async (req, res, next) => {
  try {
    const { operation_id, phase_id, task_id, content } = req.body;

    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [operation_id]);
    if (opRes.rows.length === 0) return res.status(404).json({ error: 'Operation not found' });
    const mission_id = opRes.rows[0].mission_id;

    const result = await query(
      `INSERT INTO operation_notes (operation_id, phase_id, task_id, content, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [operation_id, phase_id || null, task_id || null, content, req.user.id]
    );

    // Enrich with username
    const note = result.rows[0];
    note.created_by_name = req.user.username;

    broadcastToMission(mission_id, 'operationNote:created', note);
    res.status(201).json(note);
  } catch (err) { next(err); }
});

/** PUT /api/operation-notes/:id */
router.put('/:id', requireAuth, validate(updateNote), async (req, res, next) => {
  try {
    const { content, phase_id, task_id } = req.body;
    const result = await query(
      `UPDATE operation_notes SET
         content = COALESCE($1, content),
         phase_id = COALESCE($2, phase_id),
         task_id = COALESCE($3, task_id)
       WHERE id = $4 AND created_by = $5
       RETURNING *`,
      [content, phase_id, task_id, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found or unauthorized' });

    const note = result.rows[0];
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [note.operation_id]);
    const mission_id = opRes.rows[0]?.mission_id;
    if (mission_id) {
      broadcastToMission(mission_id, 'operationNote:updated', note);
    }

    res.json(note);
  } catch (err) { next(err); }
});

/** DELETE /api/operation-notes/:id */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM operation_notes WHERE id = $1 AND created_by = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found or unauthorized' });

    const note = result.rows[0];
    const opRes = await query('SELECT mission_id FROM operations WHERE id = $1', [note.operation_id]);
    const mission_id = opRes.rows[0]?.mission_id;
    if (mission_id) {
      broadcastToMission(mission_id, 'operationNote:deleted', { id: note.id, operation_id: note.operation_id });
    }

    res.json({ message: 'Note deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
