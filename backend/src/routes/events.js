/**
 * Event Log routes — mission timeline and audit trail
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireTeamMember } = require('../auth/teamAuth');
const { broadcastToTeam } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const EVENT_TYPES = ['contact', 'kill', 'loss', 'rescue', 'task_update', 'position_report', 'intel', 'check_in', 'check_out', 'phase_change', 'alert', 'custom'];

const createEvent = z.object({
  team_id: z.string().uuid(),
  operation_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  event: z.enum(EVENT_TYPES).default('custom'),
  title: z.string().min(1).max(256),
  details: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

/** GET /api/events?team_id=...&operation_id=...&limit=50 */
router.get('/', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    const { team_id, operation_id, event, limit } = req.query;
    let sql = `SELECT el.*, u.username AS user_name, un.name AS unit_name
               FROM event_log el
               LEFT JOIN users u ON u.id = el.user_id
               LEFT JOIN units un ON un.id = el.unit_id
               WHERE el.team_id = $1`;
    const params = [team_id];

    if (operation_id) {
      params.push(operation_id);
      sql += ` AND el.operation_id = $${params.length}`;
    }
    if (event) {
      params.push(event);
      sql += ` AND el.event = $${params.length}`;
    }

    sql += ' ORDER BY el.created_at DESC';
    params.push(parseInt(limit) || 50);
    sql += ` LIMIT $${params.length}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/events — log a new event */
router.post('/', requireAuth, validate(createEvent), requireTeamMember, async (req, res, next) => {
  try {
    const { team_id, operation_id, unit_id, event, title, details, metadata } = req.body;
    const result = await query(
      `INSERT INTO event_log (team_id, operation_id, user_id, unit_id, event, title, details, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [team_id, operation_id || null, req.user.id, unit_id || null, event, title, details, metadata ? JSON.stringify(metadata) : '{}']
    );

    broadcastToTeam(team_id, 'event:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
