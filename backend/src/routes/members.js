/**
 * Team member & join-request management routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireTeamMember } = require('../auth/teamAuth');
const { broadcastToTeam } = require('../socket');

// ---- Join by code (creates a join request) ----
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { join_code, message } = req.body;
    if (!join_code) return res.status(400).json({ error: 'join_code is required' });

    // Find team by code
    const teamResult = await query('SELECT id, name FROM teams WHERE join_code = $1', [join_code.toUpperCase()]);
    if (teamResult.rows.length === 0) return res.status(404).json({ error: 'Invalid join code' });
    const team = teamResult.rows[0];

    // Check if already a member
    const existing = await query('SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2', [team.id, req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'You are already a member of this mission' });

    // Upsert join request (re-request if previously declined)
    const result = await query(
      `INSERT INTO join_requests (team_id, user_id, message, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'pending', message = EXCLUDED.message, created_at = NOW()
       RETURNING *`,
      [team.id, req.user.id, message || null]
    );

    // Enrich with username
    const jr = result.rows[0];
    jr.username = req.user.username;

    // Notify connected team members
    broadcastToTeam(team.id, 'member:join_request', jr);

    res.status(201).json({ message: `Join request sent for "${team.name}"`, request: jr });
  } catch (err) { next(err); }
});

// ---- List pending join requests for a team ----
router.get('/:team_id/requests', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT jr.*, u.username, u.avatar_url
       FROM join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.team_id = $1 AND jr.status = 'pending'
       ORDER BY jr.created_at ASC`,
      [req.params.team_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---- Accept a join request (assign mission role) ----
router.post('/:team_id/requests/:requestId/accept', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    // Only gesamtlead (or admin) can accept
    if (req.missionRole !== 'gesamtlead') {
      // Allow gruppenlead to accept only into teamlead for their groups
      if (req.missionRole !== 'gruppenlead') {
        return res.status(403).json({ error: 'Only Gesamtlead or Gruppenlead can accept requests' });
      }
    }

    const { mission_role, assigned_group_ids } = req.body;
    const validRoles = ['gesamtlead', 'gruppenlead', 'teamlead'];
    if (!validRoles.includes(mission_role)) {
      return res.status(400).json({ error: 'mission_role must be gesamtlead, gruppenlead, or teamlead' });
    }

    // Gruppenlead can only assign teamlead within their own groups
    if (req.missionRole === 'gruppenlead') {
      if (mission_role !== 'teamlead') {
        return res.status(403).json({ error: 'Gruppenlead can only assign Teamlead role' });
      }
    }

    // Fetch the request
    const jr = await query('SELECT * FROM join_requests WHERE id = $1 AND team_id = $2 AND status = $3', [req.params.requestId, req.params.team_id, 'pending']);
    if (jr.rows.length === 0) return res.status(404).json({ error: 'Join request not found or already handled' });
    const request = jr.rows[0];

    // Map mission role to user_role (system level)
    const sysRole = mission_role === 'gesamtlead' ? 'leader' : 'member';

    // Add as team member
    await query(
      `INSERT INTO team_members (team_id, user_id, role, mission_role, assigned_group_ids)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role, mission_role = EXCLUDED.mission_role, assigned_group_ids = EXCLUDED.assigned_group_ids`,
      [req.params.team_id, request.user_id, sysRole, mission_role, assigned_group_ids || []]
    );

    // Mark request as accepted
    await query(
      `UPDATE join_requests SET status = 'accepted', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.requestId]
    );

    broadcastToTeam(req.params.team_id, 'member:accepted', { user_id: request.user_id, mission_role });

    res.json({ message: 'Join request accepted' });
  } catch (err) { next(err); }
});

// ---- Decline a join request ----
router.post('/:team_id/requests/:requestId/decline', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    if (req.missionRole !== 'gesamtlead' && req.missionRole !== 'gruppenlead') {
      return res.status(403).json({ error: 'Only Gesamtlead or Gruppenlead can decline requests' });
    }

    await query(
      `UPDATE join_requests SET status = 'declined', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2 AND team_id = $3`,
      [req.user.id, req.params.requestId, req.params.team_id]
    );

    broadcastToTeam(req.params.team_id, 'member:declined', { requestId: req.params.requestId });

    res.json({ message: 'Join request declined' });
  } catch (err) { next(err); }
});

// ---- List all members of a team ----
router.get('/:team_id/members', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT tm.*, u.username, u.avatar_url
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [req.params.team_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---- Update a member's role / assigned groups ----
router.put('/:team_id/members/:userId', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    const { mission_role, assigned_group_ids } = req.body;

    // Only gesamtlead can change roles
    if (req.missionRole !== 'gesamtlead') {
      // Gruppenlead can only update teamlead assignments in their groups
      if (req.missionRole === 'gruppenlead') {
        const target = await query('SELECT mission_role FROM team_members WHERE team_id = $1 AND user_id = $2', [req.params.team_id, req.params.userId]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
        if (target.rows[0].mission_role !== 'teamlead') {
          return res.status(403).json({ error: 'Gruppenlead can only manage Teamleads' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (mission_role) {
      updates.push(`mission_role = $${idx++}`);
      values.push(mission_role);
    }
    if (assigned_group_ids !== undefined) {
      updates.push(`assigned_group_ids = $${idx++}`);
      values.push(assigned_group_ids);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.params.team_id, req.params.userId);
    await query(
      `UPDATE team_members SET ${updates.join(', ')} WHERE team_id = $${idx++} AND user_id = $${idx}`,
      values
    );

    broadcastToTeam(req.params.team_id, 'member:updated', { user_id: req.params.userId, mission_role, assigned_group_ids });

    res.json({ message: 'Member updated' });
  } catch (err) { next(err); }
});

// ---- Remove a member from the team ----
router.delete('/:team_id/members/:userId', requireAuth, requireTeamMember, async (req, res, next) => {
  try {
    if (req.missionRole !== 'gesamtlead') {
      return res.status(403).json({ error: 'Only Gesamtlead can remove members' });
    }

    // Can't remove yourself (use leave instead)
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself. Use leave instead.' });
    }

    await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [req.params.team_id, req.params.userId]);

    broadcastToTeam(req.params.team_id, 'member:removed', { user_id: req.params.userId });

    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

module.exports = router;
