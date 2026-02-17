/**
 * Quick Messages / Check-in routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireTeamMember } = require('../auth/teamAuth');
const { broadcastToTeam } = require('../socket');
const { z } = require('zod');
const { validate } = require('../validation/middleware');

const MSG_TYPES = ['checkin', 'checkout', 'contact', 'rtb', 'winchester', 'bingo', 'hold', 'status', 'custom'];

const createMessage = z.object({
  team_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  message_type: z.enum(MSG_TYPES),
  message: z.string().max(500).optional().nullable(),
});

/** GET /api/messages?team_id=...&limit=50 */
router.get('/', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    const { team_id, limit } = req.query;
    const result = await query(
      `SELECT qm.*, u.username AS user_name, un.name AS unit_name
       FROM quick_messages qm
       LEFT JOIN users u ON u.id = qm.user_id
       LEFT JOIN units un ON un.id = qm.unit_id
       WHERE qm.team_id = $1
       ORDER BY qm.created_at DESC
       LIMIT $2`,
      [team_id, parseInt(limit) || 50]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** POST /api/messages — send a quick message */
router.post('/', requireAuth, validate(createMessage), requireTeamMember, async (req, res, next) => {
  try {
    const { team_id, unit_id, message_type, message } = req.body;
    const result = await query(
      `INSERT INTO quick_messages (team_id, user_id, unit_id, message_type, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [team_id, req.user.id, unit_id || null, message_type, message]
    );

    // Also log to event_log
    const eventTitle = `${message_type.toUpperCase()}${unit_id ? '' : ''}: ${message || message_type}`;
    await query(
      `INSERT INTO event_log (team_id, user_id, unit_id, event, title, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [team_id, req.user.id, unit_id || null, message_type === 'checkin' ? 'check_in' : message_type === 'checkout' ? 'check_out' : 'custom', eventTitle, message]
    );

    broadcastToTeam(team_id, 'message:created', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
