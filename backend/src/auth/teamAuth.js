/**
 * Mission membership authorization middleware
 * Ensures users can only access resources within missions they belong to.
 */

const { query } = require('../db/postgres');

function normalizeUuidArray(values) {
  return Array.isArray(values)
    ? values.filter((value) => typeof value === 'string' && value.length > 0)
    : [];
}

async function getMissionMemberScope(missionId, userId) {
  const result = await query(
    `SELECT role, mission_role, assigned_group_ids, assigned_unit_ids
     FROM mission_members
     WHERE mission_id = $1 AND user_id = $2`,
    [missionId, userId]
  );

  return result.rows[0] || null;
}

async function populateMissionScope(req, missionId) {
  const member = await getMissionMemberScope(missionId, req.user.id);
  if (!member) return null;

  req.missionId = missionId;
  req.teamRole = member.role;
  req.missionRole = member.mission_role || 'teamlead';
  req.assignedGroups = normalizeUuidArray(member.assigned_group_ids);
  req.assignedUnits = normalizeUuidArray(member.assigned_unit_ids);
  return member;
}

async function ensureMissionMember(req, missionId) {
  if (req.missionId === missionId && req.teamRole) {
    return true;
  }
  const member = await populateMissionScope(req, missionId);
  return !!member;
}

async function getUnitAccessContext(unitId) {
  const result = await query(
    `SELECT u.id, u.mission_id, u.group_id, u.unit_type, u.parent_unit_id,
            parent.group_id AS parent_group_id
     FROM units u
     LEFT JOIN units parent ON parent.id = u.parent_unit_id
     WHERE u.id = $1`,
    [unitId]
  );

  return result.rows[0] || null;
}

async function getShipAccessContext(unitId) {
  const result = await query(
    `SELECT id, mission_id, group_id, unit_type
     FROM units
     WHERE id = $1 AND unit_type IN ('ship', 'ground_vehicle')`,
    [unitId]
  );

  return result.rows[0] || null;
}

async function getUnitsByIdsForMission(missionId, unitIds) {
  const ids = normalizeUuidArray(unitIds);
  if (ids.length === 0) return [];

  const result = await query(
    `SELECT id, mission_id, group_id, unit_type
     FROM units
     WHERE mission_id = $1
       AND id = ANY($2::uuid[])`,
    [missionId, ids]
  );

  return result.rows;
}

function getEffectiveGroupId(unit) {
  return unit?.group_id || unit?.parent_group_id || null;
}

function isSubsetOf(candidate, allowed) {
  const normalizedCandidate = normalizeUuidArray(candidate);
  return normalizedCandidate.every((value) => allowed.includes(value));
}

/**
 * Express middleware — require the user to be a member of the mission
 * identified by `mission_id` in query params, body, or route param.
 *
 * Must be used AFTER requireAuth.
 */
function requireMissionMember(req, res, next) {
  const missionId = req.query.mission_id || req.body.mission_id || req.params.mission_id;
  if (!missionId) {
    return res.status(400).json({ error: 'mission_id is required' });
  }

  populateMissionScope(req, missionId)
    .then((member) => {
      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this mission' });
      }
      next();
    })
    .catch(next);
}

/**
 * Express middleware — require the user to be an admin or leader in the mission.
 * Must be used AFTER requireMissionMember.
 */
function requireMissionLeader(req, res, next) {
  if (!['admin', 'leader'].includes(req.teamRole)) {
    return res.status(403).json({ error: 'Requires admin or leader role in this mission' });
  }
  next();
}

/**
 * Middleware — require gesamtlead mission role.
 * Must be used AFTER requireMissionMember.
 */
function requireGesamtlead(req, res, next) {
  if (req.missionRole !== 'gesamtlead') {
    return res.status(403).json({ error: 'Requires Gesamtlead role' });
  }
  next();
}

/**
 * Middleware — require at least gruppenlead mission role.
 * Gesamtlead always passes. For gruppenlead checks if the resource's group is in assigned groups.
 * Must be used AFTER requireMissionMember.
 */
function requireGruppenlead(req, res, next) {
  if (req.missionRole === 'gesamtlead') return next();
  if (req.missionRole === 'gruppenlead') return next();
  return res.status(403).json({ error: 'Requires Gruppenlead or higher role' });
}

/**
 * Check if the user can edit a specific group.
 * Gesamtlead can edit all, gruppenlead only their assigned groups.
 */
function canEditGroup(req, groupId) {
  if (req.missionRole === 'gesamtlead') return true;
  if (req.missionRole === 'gruppenlead' && req.assignedGroups.includes(groupId)) return true;
  return false;
}

async function canEditShip(req, shipId) {
  const ship = await getShipAccessContext(shipId);
  if (!ship || ship.mission_id !== req.missionId) return false;

  if (req.missionRole === 'gesamtlead') return true;
  if (req.missionRole === 'gruppenlead') return canEditGroup(req, ship.group_id);
  if (req.missionRole === 'teamlead') return req.assignedUnits.includes(ship.id);
  return false;
}

async function canEditUnit(req, unitOrId) {
  const unit = typeof unitOrId === 'string'
    ? await getUnitAccessContext(unitOrId)
    : unitOrId;

  if (!unit || unit.mission_id !== req.missionId) return false;

  if (req.missionRole === 'gesamtlead') return true;
  if (req.missionRole === 'gruppenlead') return canEditGroup(req, getEffectiveGroupId(unit));
  if (req.missionRole === 'teamlead') {
    return unit.unit_type === 'person'
      && !!unit.parent_unit_id
      && req.assignedUnits.includes(unit.parent_unit_id);
  }
  return false;
}

async function canCreateUnitInScope(req, payload) {
  if (req.missionRole === 'gesamtlead') return true;
  if (req.missionRole !== 'gruppenlead') return false;

  if (payload.group_id && canEditGroup(req, payload.group_id)) {
    return true;
  }

  if (payload.parent_unit_id) {
    return canEditShip(req, payload.parent_unit_id);
  }

  return false;
}

module.exports = { requireMissionMember, requireMissionLeader, requireGesamtlead, requireGruppenlead, canEditGroup, canEditShip, canEditUnit, canCreateUnitInScope, ensureMissionMember, getUnitAccessContext, getShipAccessContext, getUnitsByIdsForMission, getEffectiveGroupId, isSubsetOf, normalizeUuidArray,
  // Backward-compatible aliases
  requireTeamMember: requireMissionMember, requireTeamLeader: requireMissionLeader };
