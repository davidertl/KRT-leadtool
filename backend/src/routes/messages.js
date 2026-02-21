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

const MSG_TYPES = [
  'checkin', 'checkout', 'contact', 'rtb', 'winchester', 'bingo', 'hold', 'status', 'custom', 'under_attack',
  // Status preset types (from Class_setup.md)
  'boarding', 'ready_for_takeoff', 'on_the_way', 'arrived', 'ready_for_orders', 'in_combat', 'heading_home', 'disabled',
];

/** Status message types that map 1:1 to unit status values */
const STATUS_MSG_TYPES = new Set([
  'boarding', 'ready_for_takeoff', 'on_the_way', 'arrived', 'ready_for_orders', 'in_combat', 'heading_home', 'disabled',
]);

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

    // ── "System" mode: auto-update unit status + ship aggregation ──
    const isSystem = recipient_type === 'system';
    const isStatusMsg = STATUS_MSG_TYPES.has(message_type);
    let updatedUnits = []; // track all units whose status changed (for broadcasting)

    if (isSystem && isStatusMsg && unit_id) {
      // 1. Update the reporting unit's status
      const unitRes = await query(
        `UPDATE units SET status = $1 WHERE id = $2 RETURNING *`,
        [message_type, unit_id]
      );
      if (unitRes.rows.length > 0) {
        const updatedUnit = unitRes.rows[0];
        updatedUnits.push(updatedUnit);
        broadcastToMission(mission_id, 'unit:updated', updatedUnit);

        // Record status change in history
        await query(
          `INSERT INTO status_history (unit_id, field_changed, old_value, new_value, changed_by)
           VALUES ($1, 'status', $2, $3, $4)`,
          [unit_id, JSON.stringify(updatedUnit.status), JSON.stringify(message_type), req.user.id]
        ).catch(() => {}); // non-critical

        // 2. If the unit is a person aboard a ship, check ship auto-aggregate
        if (updatedUnit.unit_type === 'person' && updatedUnit.parent_unit_id) {
          const shipId = updatedUnit.parent_unit_id;
          // Get all persons aboard this ship
          const personsRes = await query(
            `SELECT id, status FROM units WHERE parent_unit_id = $1 AND unit_type = 'person'`,
            [shipId]
          );
          const persons = personsRes.rows;
          // If all persons have the same status, update the ship
          if (persons.length > 0 && persons.every((p) => p.status === message_type)) {
            const shipRes = await query(
              `UPDATE units SET status = $1 WHERE id = $2 AND status != $1 RETURNING *`,
              [message_type, shipId]
            );
            if (shipRes.rows.length > 0) {
              updatedUnits.push(shipRes.rows[0]);
              broadcastToMission(mission_id, 'unit:updated', shipRes.rows[0]);
            }
          }
        }
      }
    }

    // ── Insert the message row ──
    // For "system" messages, still store them but mark them so the frontend can filter
    const result = await query(
      `INSERT INTO quick_messages (mission_id, user_id, unit_id, message_type, message, recipient_type, recipient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [mission_id, req.user.id, unit_id || null, message_type, message, recipient_type || null, recipient_id || null]
    );

    // Log to event_log (for system messages, use a descriptive event)
    const unitInfo = unit_id ? (await query('SELECT name, callsign FROM units WHERE id = $1', [unit_id])).rows[0] : null;
    const unitLabel = unitInfo ? (unitInfo.callsign || unitInfo.name) : 'Unknown';
    const eventTitle = isSystem && isStatusMsg
      ? `${unitLabel} status → ${message_type}`
      : `${message_type.toUpperCase()}: ${message || message_type}`;
    const eventType = isSystem && isStatusMsg ? 'custom'
      : message_type === 'checkin' ? 'check_in'
      : message_type === 'checkout' ? 'check_out'
      : 'custom';

    await query(
      `INSERT INTO event_log (mission_id, user_id, unit_id, event, title, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [mission_id, req.user.id, unit_id || null, eventType, eventTitle, message]
    );

    // Broadcast the message (frontend will filter system messages out of Recent Messages)
    broadcastToMission(mission_id, 'message:created', result.rows[0]);

    // Return the message + any units that were updated
    const response = result.rows[0];
    if (updatedUnits.length > 0) {
      response.updated_units = updatedUnits;
    }
    res.status(201).json(response);
  } catch (err) { next(err); }
});

module.exports = router;
