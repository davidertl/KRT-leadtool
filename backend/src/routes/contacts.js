/**
 * Contacts / IFF tracking CRUD routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { insertEventLog } = require('../helpers/eventLog');
const { validate } = require('../validation/middleware');
const { z } = require('zod');

// Validation schemas
const IFF_VALUES = ['friendly', 'hostile', 'neutral', 'unknown'];
const THREAT_VALUES = ['none', 'low', 'medium', 'high', 'critical'];
const CONFIDENCE_VALUES = ['unconfirmed', 'hearsay', 'comms', 'visual', 'confirmed'];

const createContact = z.object({
  mission_id: z.string().uuid(),
  iff: z.enum(IFF_VALUES).default('unknown'),
  threat: z.enum(THREAT_VALUES).default('none'),
  confidence: z.enum(CONFIDENCE_VALUES).default('unconfirmed'),
  name: z.string().max(256).optional().nullable(),
  ship_type: z.string().max(128).optional().nullable(),
  count: z.number().int().min(1).default(1),
  pos_x: z.number().finite().default(0),
  pos_y: z.number().finite().default(0),
  pos_z: z.number().finite().default(0),
  heading: z.number().finite().optional(),
  vel_x: z.number().finite().default(0),
  vel_y: z.number().finite().default(0),
  vel_z: z.number().finite().default(0),
  notes: z.string().max(2000).optional().nullable(),
});

const updateContact = z.object({
  iff: z.enum(IFF_VALUES).optional(),
  threat: z.enum(THREAT_VALUES).optional(),
  confidence: z.enum(CONFIDENCE_VALUES).optional(),
  name: z.string().max(256).optional().nullable(),
  ship_type: z.string().max(128).optional().nullable(),
  count: z.number().int().min(1).optional(),
  pos_x: z.number().finite().optional(),
  pos_y: z.number().finite().optional(),
  pos_z: z.number().finite().optional(),
  heading: z.number().finite().optional(),
  vel_x: z.number().finite().optional(),
  vel_y: z.number().finite().optional(),
  vel_z: z.number().finite().optional(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

// List contacts for a mission
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, iff, active_only } = req.query;
    let sql = `SELECT c.*, u.username AS reported_by_name
               FROM contacts c
               LEFT JOIN users u ON u.id = c.reported_by
               WHERE c.mission_id = $1`;
    const params = [mission_id];

    if (iff) {
      params.push(iff);
      sql += ` AND c.iff = $${params.length}`;
    }
    if (active_only === 'true') {
      sql += ' AND c.is_active = true';
    }

    sql += ' ORDER BY c.last_seen_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Create contact (SPOTREP)
router.post('/', requireAuth, validate(createContact), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, iff, threat, confidence, name, ship_type, count, pos_x, pos_y, pos_z, heading, vel_x, vel_y, vel_z, notes } = req.body;

    const result = await query(
      `INSERT INTO contacts (mission_id, reported_by, iff, threat, confidence, name, ship_type, count, pos_x, pos_y, pos_z, heading, vel_x, vel_y, vel_z, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [mission_id, req.user.id, iff, threat, confidence || 'unconfirmed', name, ship_type, count, pos_x, pos_y, pos_z, heading || 0, vel_x || 0, vel_y || 0, vel_z || 0, notes]
    );

    broadcastToMission(mission_id, 'contact:created', result.rows[0]);
    await insertEventLog({ mission_id, event_type: 'contact', message: `SPOTREP: ${iff} ${ship_type || 'unknown'} (×${count})${name ? ' — ' + name : ''}`, user_id: req.user.id });
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Update contact
router.put('/:id', requireAuth, validate(updateContact), async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(req.body)) {
      if (val !== undefined) {
        values.push(val);
        fields.push(`${key} = $${values.length}`);
      }
    }

    // Always update last_seen_at on any update
    fields.push(`last_seen_at = NOW()`);

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);

    const result = await query(
      `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });

    const contact = result.rows[0];
    broadcastToMission(contact.mission_id, 'contact:updated', contact);
    if (req.body.iff || req.body.threat) {
      await insertEventLog({ mission_id: contact.mission_id, event_type: 'contact', message: `Contact updated: ${contact.name || contact.id} → IFF:${contact.iff} Threat:${contact.threat}`, user_id: req.user?.id });
    }
    res.json(contact);
  } catch (err) { next(err); }
});

// Delete contact
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM contacts WHERE id = $1 RETURNING id, mission_id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });

    broadcastToMission(result.rows[0].mission_id, 'contact:deleted', { id: result.rows[0].id });
    res.json({ message: 'Contact deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
