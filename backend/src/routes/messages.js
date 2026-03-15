/**
 * Quick Messages / Check-in routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { z } = require('zod');
const { validate } = require('../validation/middleware');
const { applyStatusMessage } = require('../services/statusUpdates');

const MSG_TYPES = [
  'checkin', 'checkout', 'contact', 'rtb', 'winchester', 'bingo', 'hold', 'status', 'custom', 'under_attack',
  // Status preset types (from Class_setup.md)
  'boarding', 'ready_for_takeoff', 'on_the_way', 'arrived', 'ready_for_orders', 'in_combat', 'heading_home', 'damaged', 'disabled',
];

const createMessage = z.object({
  mission_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  message_type: z.enum(MSG_TYPES),
  message: z.string().max(500).optional().nullable(),
  recipient_type: z.enum(['all', 'unit', 'group', 'lead', 'system']).optional().nullable(),
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
    const response = await applyStatusMessage({
      actor: req.user,
      missionId: mission_id,
      unitId: unit_id || null,
      messageType: message_type,
      message,
      recipientType: recipient_type || null,
      recipientId: recipient_type !== 'all' && recipient_type !== 'system' && recipient_type !== 'lead'
        ? recipient_id || null
        : null,
      source: 'web',
      permissionContext: { req },
    });
    res.status(201).json(response);
  } catch (err) { next(err); }
});

module.exports = router;
