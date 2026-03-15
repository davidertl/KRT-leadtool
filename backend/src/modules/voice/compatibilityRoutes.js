/**
 * Compatibility routes for the legacy Companion App protocol.
 */

const pkg = require('../../../package.json');
const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../../db/postgres');
const { consumePendingState, getPendingState, requireCompanionAuth } = require('../../auth/companion');
const { validate } = require('../../validation/middleware');

const txEventSchema = z.object({
  freqId: z.number().int().min(1000).max(9999),
  action: z.enum(['start', 'stop']),
  radioSlot: z.number().int().min(0).max(16).optional().nullable(),
  meta: z.record(z.unknown()).optional(),
});

const frequencySchema = z.object({
  freqId: z.number().int().min(1000).max(9999),
  radioSlot: z.number().int().min(0).max(16).optional().nullable(),
});

function createVoiceCompatibilityRoutes({ voiceRelay }) {
  router.get('/server-status', (_req, res) => {
    res.json({
      ok: true,
      data: {
        version: pkg.version,
        dsgvoEnabled: false,
        debugMode: process.env.NODE_ENV !== 'production',
        retentionDays: 0,
        policyVersion: '1.0',
        oauthEnabled: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
      },
    });
  });

  router.get('/privacy-policy', (_req, res) => {
    res.json({
      ok: true,
      data: {
        version: '1.0',
        text: process.env.COMPANION_PRIVACY_POLICY_TEXT || 'Companion authentication uses Discord OAuth. Voice transport is relayed without storing audio content.',
      },
    });
  });

  router.get('/auth/discord/redirect', (req, res) => {
    const search = new URLSearchParams(req.query).toString();
    res.redirect(`/api/companion/auth/discord${search ? `?${search}` : ''}`);
  });

  router.get('/auth/discord/callback', (req, res) => {
    const search = new URLSearchParams(req.query).toString();
    res.redirect(`/api/companion/auth/callback${search ? `?${search}` : ''}`);
  });

  router.get('/auth/discord/poll', (req, res) => {
    const { state } = req.query;
    if (!state) {
      return res.status(400).json({ ok: false, error: 'missing_state' });
    }

    const pending = getPendingState(String(state));
    if (!pending) {
      return res.json({ ok: true, data: { status: 'unknown' } });
    }
    if (pending.status === 'pending') {
      return res.json({ ok: true, data: { status: 'pending' } });
    }

    const result = consumePendingState(String(state));
    if (result.status === 'error') {
      return res.json({ ok: true, data: { status: 'error', error: result.error || 'oauth_failed' } });
    }

    return res.json({
      ok: true,
      data: {
        status: 'success',
        token: result.token,
        displayName: result.username,
        policyVersion: '1.0',
        policyAccepted: true,
      },
    });
  });

  router.post('/auth/accept-policy', requireCompanionAuth(['companion']), (_req, res) => {
    res.json({ ok: true, data: { accepted: true, version: '1.0' } });
  });

  router.post('/tx/event', requireCompanionAuth(['voice']), validate(txEventSchema), async (req, res, next) => {
    try {
      const result = await query(
        `INSERT INTO voice_tx_events (user_id, freq_id, radio_slot, action, source, metadata)
         VALUES ($1, $2, $3, $4, 'companion', $5)
         RETURNING *`,
        [
          req.user.id,
          req.body.freqId,
          req.body.radioSlot ?? null,
          req.body.action,
          JSON.stringify(req.body.meta || {}),
        ]
      );

      voiceRelay.notifyTxEvent({
        freqId: req.body.freqId,
        radioSlot: req.body.radioSlot ?? null,
        action: req.body.action,
        userId: req.user.id,
        username: req.user.username,
        metadata: req.body.meta || {},
      });

      res.json({
        ok: true,
        data: result.rows[0],
        listener_count: voiceRelay.getListenerCount(req.body.freqId),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/freq/join', requireCompanionAuth(['voice']), validate(frequencySchema), async (req, res) => {
    res.json({
      ok: true,
      listener_count: voiceRelay.getListenerCount(req.body.freqId),
    });
  });

  router.post('/freq/leave', requireCompanionAuth(['voice']), validate(frequencySchema.pick({ freqId: true })), async (req, res) => {
    res.json({
      ok: true,
      listener_count: voiceRelay.getListenerCount(req.body.freqId),
    });
  });

  router.post('/freq/name', requireCompanionAuth(['voice']), (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/freq/names', (_req, res) => {
    res.json({ ok: true, data: {} });
  });

  return router;
}

module.exports = { createVoiceCompatibilityRoutes };
