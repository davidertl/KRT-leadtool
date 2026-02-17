/**
 * Team membership authorization middleware
 * Ensures users can only access resources within teams they belong to.
 */

const { query } = require('../db/postgres');

/**
 * Express middleware — require the user to be a member of the team
 * identified by `team_id` in query params, body, or route param.
 *
 * Must be used AFTER requireAuth.
 */
function requireTeamMember(req, res, next) {
  const teamId = req.query.team_id || req.body.team_id || req.params.team_id;
  if (!teamId) {
    return res.status(400).json({ error: 'team_id is required' });
  }

  query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, req.user.id]
  )
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this team' });
      }
      req.teamRole = result.rows[0].role;
      next();
    })
    .catch(next);
}

/**
 * Express middleware — require the user to be an admin or leader in the team.
 * Must be used AFTER requireTeamMember.
 */
function requireTeamLeader(req, res, next) {
  if (!['admin', 'leader'].includes(req.teamRole)) {
    return res.status(403).json({ error: 'Requires admin or leader role in this team' });
  }
  next();
}

module.exports = { requireTeamMember, requireTeamLeader };
