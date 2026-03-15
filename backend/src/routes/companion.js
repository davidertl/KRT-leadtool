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
const { requireMissionMember, canEditUnit, canEditShip, getUnitAccessContext } = require('../auth/teamAuth');
const { normalizeMissionSettings, isCompanionStatusSyncEnabled } = require('../services/missionSettings');
const { STATUS_MESSAGE_TYPES, applyStatusMessage } = require('../services/statusUpdates');
const { validate } = require('../validation/middleware');
const { broadcastToMission } = require('../socket');

// Display labels for Comms status buttons (single source of truth for WebUI and Companion).
const STATUS_TYPE_LABELS = {
  boarding: 'Boarding',
  ready_for_takeoff: 'Ready for Takeoff',
  on_the_way: 'On the Way',
  arrived: 'Arrived',
  ready_for_orders: 'Ready for Orders',
  in_combat: 'In Combat',
  heading_home: 'Heading Home',
  damaged: 'Damaged',
  disabled: 'Disabled',
};

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

const companionResetPositionSchema = z.object({
  mission_id: z.string().uuid(),
  unit_id: z.string().uuid(),
});

const companionAssignSchema = z.object({
  mission_id: z.string().uuid(),
});

const companionBoardSchema = z.object({
  mission_id: z.string().uuid(),
  ship_id: z.string().uuid().optional().nullable(),
});

const companionSetPositionSchema = z.object({
  mission_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  pos_x: z.number().finite(),
  pos_y: z.number().finite(),
  pos_z: z.number().finite(),
  heading: z.number().finite().optional().nullable(),
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

// Status types for Comms (type + label). No mission required; used by Companion to show status buttons.
router.get('/status-types', requireCompanionAuth(['companion']), (_req, res) => {
  const types = Array.from(STATUS_MESSAGE_TYPES).map((type) => ({
    type,
    label: STATUS_TYPE_LABELS[type] || type,
  }));
  res.json(types);
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

// Create a person in the mission with user's name and set as primary (idempotent if already assigned).
router.post('/assign', requireCompanionAuth(['companion']), validate(companionAssignSchema), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id } = req.body;
    const memberResult = await query(
      `SELECT primary_unit_id FROM mission_members WHERE mission_id = $1 AND user_id = $2`,
      [mission_id, req.user.id]
    );
    const member = memberResult.rows[0];
    if (!member) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    if (member.primary_unit_id) {
      const unitRow = await query('SELECT * FROM units WHERE id = $1', [member.primary_unit_id]);
      return res.status(200).json(unitRow.rows[0] || { id: member.primary_unit_id });
    }
    const createResult = await query(
      `INSERT INTO units (name, unit_type, owner_id, mission_id, discord_id, status, pos_x, pos_y, pos_z, heading)
       VALUES ($1, 'person', $2, $3, $4, 'disabled', 0, 0, 0, 0)
       RETURNING *`,
      [
        req.user.username || 'Companion',
        req.user.id,
        mission_id,
        req.user.discord_id || null,
      ]
    );
    const newPerson = createResult.rows[0];
    await query(
      `UPDATE mission_members SET primary_unit_id = $1 WHERE mission_id = $2 AND user_id = $3`,
      [newPerson.id, mission_id, req.user.id]
    );
    broadcastToMission(mission_id, 'unit:created', newPerson);
    broadcastToMission(mission_id, 'member:updated', { primary_unit_id: newPerson.id });
    res.status(201).json(newPerson);
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

    let resolvedUnitId = unit_id || mission.primary_unit_id || null;

    // On first status use: create a person unit for this user and set as primary
    if (STATUS_MESSAGE_TYPES.has(message_type) && !resolvedUnitId) {
      const createResult = await query(
        `INSERT INTO units (name, unit_type, owner_id, mission_id, discord_id, status, pos_x, pos_y, pos_z, heading)
         VALUES ($1, 'person', $2, $3, $4, $5, 0, 0, 0, 0)
         RETURNING *`,
        [
          req.user.username || 'Companion',
          req.user.id,
          mission_id,
          req.user.discord_id || null,
          message_type,
        ]
      );
      const newPerson = createResult.rows[0];
      await query(
        `UPDATE mission_members SET primary_unit_id = $1 WHERE mission_id = $2 AND user_id = $3`,
        [newPerson.id, mission_id, req.user.id]
      );
      broadcastToMission(mission_id, 'unit:created', newPerson);
      broadcastToMission(mission_id, 'member:updated', { primary_unit_id: newPerson.id });
      resolvedUnitId = newPerson.id;
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

// Reset unit position to origin (pos 0, heading 0). Allowed for gesamtlead; gruppenlead/teamlead for their scope.
router.post('/units/reset-position', requireCompanionAuth(['companion']), validate(companionResetPositionSchema), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, unit_id } = req.body;
    const unitAccess = await getUnitAccessContext(unit_id);
    if (!unitAccess || unitAccess.mission_id !== mission_id) {
      return res.status(404).json({ error: 'Unit not found in this mission' });
    }
    const canEdit = await canEditUnit(req, unitAccess);
    if (!canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions to reset this unit\'s location' });
    }
    const result = await query(
      `UPDATE units SET pos_x = 0, pos_y = 0, pos_z = 0, heading = 0 WHERE id = $1 RETURNING *`,
      [unit_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    broadcastToMission(mission_id, 'unit:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Board: set primary person's parent_unit_id to ship (or null to unboard). Ship must be in mission and user must have canEditShip.
router.post('/units/board', requireCompanionAuth(['companion']), validate(companionBoardSchema), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, ship_id } = req.body;
    const memberResult = await query(
      `SELECT primary_unit_id FROM mission_members WHERE mission_id = $1 AND user_id = $2`,
      [mission_id, req.user.id]
    );
    const member = memberResult.rows[0];
    if (!member || !member.primary_unit_id) {
      return res.status(400).json({ error: 'No person assigned in this mission. Use Assign first.' });
    }
    const personResult = await query(
      `SELECT id, unit_type, mission_id FROM units WHERE id = $1`,
      [member.primary_unit_id]
    );
    const person = personResult.rows[0];
    if (!person || person.unit_type !== 'person') {
      return res.status(400).json({ error: 'Primary unit is not a person' });
    }
    if (ship_id) {
      const shipResult = await query(
        `SELECT id, mission_id, unit_type FROM units WHERE id = $1`,
        [ship_id]
      );
      const ship = shipResult.rows[0];
      if (!ship || ship.mission_id !== mission_id) {
        return res.status(404).json({ error: 'Ship not found in this mission' });
      }
      if (ship.unit_type !== 'ship' && ship.unit_type !== 'ground_vehicle') {
        return res.status(400).json({ error: 'Target unit is not a ship or ground vehicle' });
      }
      const canBoard = await canEditShip(req, ship_id);
      if (!canBoard) {
        return res.status(403).json({ error: 'Insufficient permissions to board this ship' });
      }
    }
    const result = await query(
      `UPDATE units SET parent_unit_id = $1 WHERE id = $2 RETURNING *`,
      [ship_id || null, person.id]
    );
    broadcastToMission(mission_id, 'unit:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Set unit position (custom coordinates). Same permission as reset-position.
router.post('/units/set-position', requireCompanionAuth(['companion']), validate(companionSetPositionSchema), requireMissionMember, async (req, res, next) => {
  try {
    const { mission_id, unit_id, pos_x, pos_y, pos_z, heading } = req.body;
    const unitAccess = await getUnitAccessContext(unit_id);
    if (!unitAccess || unitAccess.mission_id !== mission_id) {
      return res.status(404).json({ error: 'Unit not found in this mission' });
    }
    const canEdit = await canEditUnit(req, unitAccess);
    if (!canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions to set this unit\'s location' });
    }
    const headingVal = heading != null ? heading : null;
    const result = await query(
      `UPDATE units SET pos_x = $1, pos_y = $2, pos_z = $3, heading = COALESCE($4, heading) WHERE id = $5 RETURNING *`,
      [pos_x, pos_y, pos_z, headingVal, unit_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    broadcastToMission(mission_id, 'unit:updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
