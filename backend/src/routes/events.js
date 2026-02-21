/**
 * Event Log routes — mission timeline and audit trail
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const EVENT_TYPES = ['contact', 'kill', 'loss', 'rescue', 'task_update', 'position_report', 'intel', 'check_in', 'check_out', 'phase_change', 'alert', 'custom'];

const createEvent = z.object({
  mission_id: z.string().uuid(),
  operation_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  event: z.enum(EVENT_TYPES).default('custom'),
  title: z.string().min(1).max(256),
  details: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/** GET /api/events?mission_id=...&operation_id=...&event=...&unit_id=...&from=...&to=...&search=...&limit=50 */
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, operation_id, event, unit_id, from, to, search, limit } = req.query;
    let sql = `SELECT el.*, u.username AS user_name, un.name AS unit_name
               FROM event_log el
               LEFT JOIN users u ON u.id = el.user_id
               LEFT JOIN units un ON un.id = el.unit_id
               WHERE el.mission_id = $1`;
    const params = [mission_id];

    if (operation_id) {
      params.push(operation_id);
      sql += ` AND el.operation_id = $${params.length}`;
    }
    if (event) {
      params.push(event);
      sql += ` AND el.event = $${params.length}`;
    }
    if (unit_id) {
      params.push(unit_id);
      sql += ` AND el.unit_id = $${params.length}`;
    }
    if (from) {
      params.push(from);
      sql += ` AND el.created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      sql += ` AND el.created_at <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (el.title ILIKE $${params.length} OR el.details ILIKE $${params.length} OR el.message ILIKE $${params.length})`;
    }

    sql += ' ORDER BY el.created_at DESC';
    params.push(parseInt(limit) || 100);
    sql += ` LIMIT $${params.length}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** GET /api/events/export?mission_id=...  — CSV export of events */
router.get('/export', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, operation_id } = req.query;
    let sql = `SELECT el.created_at, el.event, el.title, el.details, el.message,
                      u.username AS user_name, un.name AS unit_name
               FROM event_log el
               LEFT JOIN users u ON u.id = el.user_id
               LEFT JOIN units un ON un.id = el.unit_id
               WHERE el.mission_id = $1`;
    const params = [mission_id];
    if (operation_id) {
      params.push(operation_id);
      sql += ` AND el.operation_id = $${params.length}`;
    }
    sql += ' ORDER BY el.created_at ASC';

    const result = await query(sql, params);

    // Build CSV
    const header = 'Timestamp,Event,Title,Details,Message,User,Unit';
    const rows = result.rows.map(r => {
      const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      return [esc(r.created_at), esc(r.event), esc(r.title), esc(r.details), esc(r.message), esc(r.user_name), esc(r.unit_name)].join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=event_log.csv');
    res.send([header, ...rows].join('\n'));
  } catch (err) { next(err); }
});

/** POST /api/events — log a new event */
router.post('/', requireAuth, validate(createEvent), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, operation_id, unit_id, event, title, details, metadata } = req.body;
    const result = await query(
      `INSERT INTO event_log (mission_id, operation_id, user_id, unit_id, event, title, details, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [mission_id, operation_id || null, req.user.id, unit_id || null, event, title, details, metadata ? JSON.stringify(metadata) : '{}']
    );

    broadcastToMission(mission_id, 'event:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
