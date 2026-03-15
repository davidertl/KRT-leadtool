/**
 * Voice module HTTP routes.
 */

const createRouter = () => require('express').Router();
const { z } = require('zod');
const { query } = require('../../db/postgres');
const { requireCompanionAuth } = require('../../auth/companion');
const { requireMissionMember } = require('../../auth/teamAuth');
const { validate } = require('../../validation/middleware');

const txEventSchema = z.object({
  freqId: z.number().int().min(1000).max(9999),
  action: z.enum(['start', 'stop']),
  radioSlot: z.number().int().min(0).max(16).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const frequencyMembershipSchema = z.object({
  freqId: z.number().int().min(1000).max(9999),
  radioSlot: z.number().int().min(0).max(16).optional().nullable(),
});

function createVoiceRoutes({ voiceRelay }) {
  const router = createRouter();

  router.get('/status', async (_req, res) => {
    res.json({ ok: true, module: 'voice' });
  });

  router.post('/tx-event', requireCompanionAuth(['voice']), validate(txEventSchema), async (req, res, next) => {
    try {
      const meta = req.body.metadata ?? req.body.meta ?? {};
      const result = await query(
        `INSERT INTO voice_tx_events (user_id, freq_id, radio_slot, action, source, metadata)
         VALUES ($1, $2, $3, $4, 'companion', $5)
         RETURNING *`,
        [
          req.user.id,
          req.body.freqId,
          req.body.radioSlot ?? null,
          req.body.action,
          JSON.stringify(meta),
        ]
      );

      const payload = {
        freqId: req.body.freqId,
        radioSlot: req.body.radioSlot ?? null,
        action: req.body.action,
        userId: req.user.id,
        username: req.user.username,
        metadata: meta,
      };

      voiceRelay.notifyTxEvent(payload);

      res.json({
        ok: true,
        data: result.rows[0],
        listener_count: voiceRelay.getListenerCount(req.body.freqId),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/tx-events', requireCompanionAuth(['voice']), async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const freqId = req.query.freqId ? Number(req.query.freqId) : null;

      const result = await query(
        `SELECT vte.*, u.username
         FROM voice_tx_events vte
         LEFT JOIN users u ON u.id = vte.user_id
         WHERE ($1::int IS NULL OR vte.freq_id = $1)
         ORDER BY vte.created_at DESC
         LIMIT $2`,
        [freqId, limit]
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post('/frequencies/join', requireCompanionAuth(['voice']), validate(frequencyMembershipSchema), async (req, res) => {
    res.json({
      ok: true,
      freqId: req.body.freqId,
      listener_count: voiceRelay.getListenerCount(req.body.freqId),
    });
  });

  router.post('/frequencies/leave', requireCompanionAuth(['voice']), validate(frequencyMembershipSchema.pick({ freqId: true })), async (req, res) => {
    res.json({
      ok: true,
      freqId: req.body.freqId,
      listener_count: voiceRelay.getListenerCount(req.body.freqId),
    });
  });

  router.post('/frequencies/name', requireCompanionAuth(['voice']), (req, res) => {
    res.json({ ok: true });
  });

  router.get('/frequencies/names', (_req, res) => {
    res.json({ ok: true, data: {} });
  });

  router.get('/frequencies', requireCompanionAuth(['voice']), requireMissionMember, async (req, res, next) => {
    try {
      const missionId = req.query.mission_id;
      const groups = await query(
        `SELECT id, name, vhf_channel
         FROM groups
         WHERE mission_id = $1 AND vhf_channel IS NOT NULL
         ORDER BY name ASC`,
        [missionId]
      );
      const units = await query(
        `SELECT id, name, callsign, vhf_frequency
         FROM units
         WHERE mission_id = $1 AND vhf_frequency IS NOT NULL
         ORDER BY name ASC`,
        [missionId]
      );

      const frequencies = [
        ...groups.rows.map((group) => ({
          type: 'group',
          id: group.id,
          label: group.name,
          value: group.vhf_channel,
        })),
        ...units.rows.map((unit) => ({
          type: 'unit',
          id: unit.id,
          label: unit.callsign || unit.name,
          value: String(unit.vhf_frequency),
        })),
      ];

      res.json(frequencies);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createVoiceRoutes };
