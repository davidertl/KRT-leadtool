/**
 * Mission membership authorization middleware
 * Ensures users can only access resources within missions they belong to.
 */

const { query } = require('../db/postgres');

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

  query(
    'SELECT role, mission_role, assigned_group_ids FROM mission_members WHERE mission_id = $1 AND user_id = $2',
    [missionId, req.user.id]
  )
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this mission' });
      }
      req.teamRole = result.rows[0].role;
      req.missionRole = result.rows[0].mission_role || 'teamlead';
      req.assignedGroups = result.rows[0].assigned_group_ids || [];
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

module.exports = { requireMissionMember, requireMissionLeader, requireGesamtlead, requireGruppenlead, canEditGroup,
  // Backward-compatible aliases
  requireTeamMember: requireMissionMember, requireTeamLeader: requireMissionLeader };
