/**
 * Companion App routes: native auth, bootstrap, and status sync.
 */

const pkg = require('../../package.json');
const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../db/postgres');
const {
  beginPendingState,
  consumePendingState,
  createCompanionSession,
  exchangeDiscordCode,
  getPendingState,
  requireCompanionAuth,
  revokeCompanionSession,
  upsertDiscordUser,
} = require('../auth/companion');
const { requireMissionMember, canEditUnit, getUnitAccessContext } = require('../auth/teamAuth');
const { normalizeMissionSettings, isCompanionStatusSyncEnabled } = require('../services/missionSettings');
const { STATUS_MESSAGE_TYPES, applyStatusMessage } = require('../services/statusUpdates');
const { validate } = require('../validation/middleware');

const MESSAGE_TYPES = [
  'checkin', 'checkout', 'contact', 'rtb', 'winchester', 'bingo', 'hold', 'status', 'custom', 'under_attack',
  'boarding', 'ready_for_takeoff', 'on_the_way', 'arrived', 'ready_for_orders', 'in_combat', 'heading_home', 'damaged', 'disabled',
];

const companionStatusSchema = z.object({
  mission_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  message_type: z.enum(MESSAGE_TYPES),
  message: z.string().max(500).optional().nullable(),
});

function getCompanionRedirectUri(req) {
  return process.env.COMPANION_DISCORD_CALLBACK_URL
    || `${req.protocol}://${req.get('host')}/api/companion/auth/callback`;
}

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

router.get('/auth/discord', (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).send('Missing state parameter');
  if (!process.env.DISCORD_CLIENT_ID) return res.status(500).send('Discord OAuth is not configured');

  beginPendingState(String(state));

  const scope = 'identify';
  let url = 'https://discord.com/oauth2/authorize?response_type=code';
  url += `&client_id=${encodeURIComponent(process.env.DISCORD_CLIENT_ID)}`;
  url += `&scope=${encodeURIComponent(scope)}`;
  url += `&state=${encodeURIComponent(String(state))}`;
  url += `&redirect_uri=${encodeURIComponent(getCompanionRedirectUri(req))}`;
  url += '&prompt=consent';

  res.redirect(url);
});

router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  if (!getPendingState(String(state))) return res.status(400).send('Unknown or expired state');

  try {
    const discordUser = await exchangeDiscordCode({
      code,
      redirectUri: getCompanionRedirectUri(req),
    });
    const user = await upsertDiscordUser(discordUser);
    const { token, session } = await createCompanionSession(user, { sessionName: 'Companion App' });

    beginPendingState(String(state));
    const pending = getPendingState(String(state));
    pending.status = 'success';
    pending.createdAt = Date.now();
    pending.token = token;
    pending.session = session;
    pending.username = user.username;

    res.send('Login successful. You can close this window and return to the Companion App.');
  } catch (error) {
    beginPendingState(String(state));
    const pending = getPendingState(String(state));
    pending.status = 'error';
    pending.createdAt = Date.now();
    pending.error = 'oauth_failed';
    res.status(500).send('Login failed. Please return to the Companion App and try again.');
  }
});

router.get('/auth/poll', (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).json({ ok: false, error: 'state is required' });

  const pending = getPendingState(String(state));
  if (!pending) {
    return res.json({ ok: true, data: { status: 'unknown' } });
  }

  if (pending.status === 'pending') {
    return res.json({ ok: true, data: { status: 'pending' } });
  }

  const result = consumePendingState(String(state));
  if (result.status === 'error') {
    return res.json({ ok: true, data: { status: 'error', error: result.error || 'unknown_error' } });
  }

  return res.json({
    ok: true,
    data: {
      status: 'success',
      token: result.token,
      session: result.session,
      displayName: result.username,
      policyVersion: '1.0',
      policyAccepted: true,
    },
  });
});

router.get('/me', requireCompanionAuth(['companion']), async (req, res, next) => {
  try {
    const missions = await query(
      `SELECT m.id, m.name, mm.mission_role, mm.assigned_group_ids, mm.assigned_unit_ids, mm.primary_unit_id, m.settings
       FROM missions m
       JOIN mission_members mm ON mm.mission_id = m.id
       WHERE mm.user_id = $1
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );

    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        discord_id: req.user.discord_id,
      },
      missions: missions.rows.map((mission) => ({
        ...mission,
        settings: normalizeMissionSettings(mission.settings),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/revoke', requireCompanionAuth(['companion']), async (req, res, next) => {
  try {
    await revokeCompanionSession(req.user.session_id, req.user.id);
    res.json({ revoked: true });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/accept-policy', requireCompanionAuth(['companion']), async (_req, res) => {
  res.json({ accepted: true, version: '1.0' });
});

router.get('/bootstrap', requireCompanionAuth(['companion']), requireMissionMember, async (req, res, next) => {
  try {
    const missionId = req.query.mission_id;
    const missionResult = await query(
      `SELECT m.id, m.name, m.settings, mm.mission_role, mm.assigned_group_ids, mm.assigned_unit_ids, mm.primary_unit_id
       FROM missions m
       JOIN mission_members mm ON mm.mission_id = m.id
       WHERE m.id = $1 AND mm.user_id = $2`,
      [missionId, req.user.id]
    );

    const mission = missionResult.rows[0];
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const unitsResult = await query(
      `SELECT id, mission_id, name, callsign, unit_type, parent_unit_id, group_id, status, vhf_frequency
       FROM units
       WHERE mission_id = $1
       ORDER BY name ASC`,
      [missionId]
    );

    const reportableUnits = [];
    for (const unit of unitsResult.rows) {
      const accessContext = await getUnitAccessContext(unit.id);
      if (accessContext && await canEditUnit(req, accessContext)) {
        reportableUnits.push(unit);
      }
    }
    // Ensure user can always report for self (primary unit) when set
    const primaryId = mission.primary_unit_id;
    if (primaryId && !reportableUnits.some((u) => u.id === primaryId)) {
      const primaryUnit = unitsResult.rows.find((u) => u.id === primaryId);
      if (primaryUnit) reportableUnits.push(primaryUnit);
    }

    res.json({
      mission: {
        ...mission,
        settings: normalizeMissionSettings(mission.settings),
      },
      units: unitsResult.rows,
      reportable_units: reportableUnits,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/status', requireCompanionAuth(['status']), validate(companionStatusSchema), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, unit_id, message_type, message } = req.body;

    const missionResult = await query(
      `SELECT m.settings, mm.primary_unit_id
       FROM missions m
       JOIN mission_members mm ON mm.mission_id = m.id
       WHERE m.id = $1 AND mm.user_id = $2`,
      [mission_id, req.user.id]
    );

    const mission = missionResult.rows[0];
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    if (!isCompanionStatusSyncEnabled(mission.settings)) {
      return res.status(409).json({ error: 'Companion status sync is currently disabled for this mission' });
    }

    const resolvedUnitId = unit_id || mission.primary_unit_id || null;
    if (STATUS_MESSAGE_TYPES.has(message_type) && !resolvedUnitId) {
      return res.status(400).json({ error: 'No reporting unit is bound for this companion session' });
    }

    const response = await applyStatusMessage({
      actor: req.user,
      missionId: mission_id,
      unitId: resolvedUnitId,
      messageType: message_type,
      message,
      recipientType: 'system',
      recipientId: null,
      source: 'companion',
      permissionContext: { req },
    });

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
