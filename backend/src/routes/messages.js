/**
 * Quick Messages / Check-in routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const MSG_TYPES = ['checkin', 'checkout', 'contact', 'rtb', 'winchester', 'bingo', 'hold', 'status', 'custom', 'under_attack'];

const createMessage = z.object({
  mission_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  message_type: z.enum(MSG_TYPES),
  message: z.string().max(500).optional().nullable(),
  recipient_type: z.enum(['all', 'unit', 'group']).optional().nullable(),
  recipient_id: z.string().uuid().optional().nullable(),
});

/** GET /api/messages?mission_id=...&limit=50 */
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, limit } = req.query;
    const result = await query(
      `SELECT qm.*, u.username AS user_name, un.name AS unit_name
       FROM quick_messages qm
       LEFT JOIN users u ON u.id = qm.user_id
       LEFT JOIN units un ON un.id = qm.unit_id
       WHERE qm.mission_id = $1
       ORDER BY qm.created_at DESC
       LIMIT $2`,
      [mission_id, parseInt(limit) || 50]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/messages — send a quick message */
router.post('/', requireAuth, validate(createMessage), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, unit_id, message_type, message, recipient_type, recipient_id } = req.body;
    const result = await query(
      `INSERT INTO quick_messages (mission_id, user_id, unit_id, message_type, message, recipient_type, recipient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [mission_id, req.user.id, unit_id || null, message_type, message, recipient_type || null, recipient_id || null]
    );

    // Also log to event_log
    const eventTitle = `${message_type.toUpperCase()}${unit_id ? '' : ''}: ${message || message_type}`;
    await query(
      `INSERT INTO event_log (mission_id, user_id, unit_id, event, title, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [mission_id, req.user.id, unit_id || null, message_type === 'checkin' ? 'check_in' : message_type === 'checkout' ? 'check_out' : 'custom', eventTitle, message]
    );

    broadcastToMission(mission_id, 'message:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
