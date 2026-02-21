/**
 * Mission member & join-request management routes
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');

// ---- Join by code (creates a join request) ----
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { join_code, message } = req.body;
    if (!join_code) return res.status(400).json({ error: 'join_code is required' });

    // Find mission by code
    const missionResult = await query('SELECT id, name FROM missions WHERE join_code = $1', [join_code.toUpperCase()]);
    if (missionResult.rows.length === 0) return res.status(404).json({ error: 'Invalid join code' });
    const mission = missionResult.rows[0];

    // Check if already a member
    const existing = await query('SELECT 1 FROM mission_members WHERE mission_id = $1 AND user_id = $2', [mission.id, req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'You are already a member of this mission' });

    // Upsert join request (re-request if previously declined)
    const result = await query(
      `INSERT INTO join_requests (mission_id, user_id, message, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (mission_id, user_id) DO UPDATE SET status = 'pending', message = EXCLUDED.message, created_at = NOW()
       RETURNING *`,
      [mission.id, req.user.id, message || null]
    );

    // Enrich with username
    const jr = result.rows[0];
    jr.username = req.user.username;

    // Notify connected mission members
    broadcastToMission(mission.id, 'member:join_request', jr);

    res.status(201).json({ message: `Join request sent for "${mission.name}"`, request: jr });
  } catch (err) { next(err); }
});

// ---- List pending join requests for a mission ----
router.get('/:mission_id/requests', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT jr.*, u.username, u.avatar_url
       FROM join_requests jr
       JOIN users u ON u.id = jr.user_id
       WHERE jr.mission_id = $1 AND jr.status = 'pending'
       ORDER BY jr.created_at ASC`,
      [req.params.mission_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---- Accept a join request (assign mission role) ----
router.post('/:mission_id/requests/:requestId/accept', requireAuth, requireMissionMember, async (req, res, next) => {
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
    const jr = await query('SELECT * FROM join_requests WHERE id = $1 AND mission_id = $2 AND status = $3', [req.params.requestId, req.params.mission_id, 'pending']);
    if (jr.rows.length === 0) return res.status(404).json({ error: 'Join request not found or already handled' });
    const request = jr.rows[0];

    // Map mission role to user_role (system level)
    const sysRole = mission_role === 'gesamtlead' ? 'leader' : 'member';

    // Add as mission member
    await query(
      `INSERT INTO mission_members (mission_id, user_id, role, mission_role, assigned_group_ids)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (mission_id, user_id) DO UPDATE SET role = EXCLUDED.role, mission_role = EXCLUDED.mission_role, assigned_group_ids = EXCLUDED.assigned_group_ids`,
      [req.params.mission_id, request.user_id, sysRole, mission_role, assigned_group_ids || []]
    );

    // Mark request as accepted
    await query(
      `UPDATE join_requests SET status = 'accepted', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.requestId]
    );

    broadcastToMission(req.params.mission_id, 'member:accepted', { user_id: request.user_id, mission_role });

    res.json({ message: 'Join request accepted' });
  } catch (err) { next(err); }
});

// ---- Decline a join request ----
router.post('/:mission_id/requests/:requestId/decline', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    if (req.missionRole !== 'gesamtlead' && req.missionRole !== 'gruppenlead') {
      return res.status(403).json({ error: 'Only Gesamtlead or Gruppenlead can decline requests' });
    }

    await query(
      `UPDATE join_requests SET status = 'declined', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2 AND mission_id = $3`,
      [req.user.id, req.params.requestId, req.params.mission_id]
    );

    broadcastToMission(req.params.mission_id, 'member:declined', { requestId: req.params.requestId });

    res.json({ message: 'Join request declined' });
  } catch (err) { next(err); }
});

// ---- List all members of a mission ----
router.get('/:mission_id/members', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT mm.*, u.username, u.avatar_url
       FROM mission_members mm
       JOIN users u ON u.id = mm.user_id
       WHERE mm.mission_id = $1
       ORDER BY mm.joined_at ASC`,
      [req.params.mission_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---- Update a member's role / assigned groups ----
router.put('/:mission_id/members/:userId', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const { mission_role, assigned_group_ids } = req.body;

    // Only gesamtlead can change roles
    if (req.missionRole !== 'gesamtlead') {
      // Gruppenlead can only update teamlead assignments in their groups
      if (req.missionRole === 'gruppenlead') {
        const target = await query('SELECT mission_role FROM mission_members WHERE mission_id = $1 AND user_id = $2', [req.params.mission_id, req.params.userId]);
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

    values.push(req.params.mission_id, req.params.userId);
    await query(
      `UPDATE mission_members SET ${updates.join(', ')} WHERE mission_id = $${idx++} AND user_id = $${idx}`,
      values
    );

    broadcastToMission(req.params.mission_id, 'member:updated', { user_id: req.params.userId, mission_role, assigned_group_ids });

    res.json({ message: 'Member updated' });
  } catch (err) { next(err); }
});

// ---- Remove a member from the mission ----
router.delete('/:mission_id/members/:userId', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    if (req.missionRole !== 'gesamtlead') {
      return res.status(403).json({ error: 'Only Gesamtlead can remove members' });
    }

    // Can't remove yourself (use leave instead)
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself. Use leave instead.' });
    }

    await query('DELETE FROM mission_members WHERE mission_id = $1 AND user_id = $2', [req.params.mission_id, req.params.userId]);

    broadcastToMission(req.params.mission_id, 'member:removed', { user_id: req.params.userId });

    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

// ---- Leave a mission ----
router.post('/:mission_id/leave', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    // Check if user is the owner — owners must delete the mission or transfer ownership
    const mission = await query('SELECT owner_id FROM missions WHERE id = $1', [req.params.mission_id]);
    if (mission.rows.length > 0 && mission.rows[0].owner_id === req.user.id) {
      return res.status(400).json({ error: 'Mission owner cannot leave. Delete the mission or transfer ownership.' });
    }

    await query('DELETE FROM mission_members WHERE mission_id = $1 AND user_id = $2', [req.params.mission_id, req.user.id]);

    broadcastToMission(req.params.mission_id, 'member:removed', { user_id: req.user.id });

    res.json({ message: 'You have left the mission' });
  } catch (err) { next(err); }
});

// ---- Join a public mission (no code needed) ----
router.post('/join-public', requireAuth, async (req, res, next) => {
  try {
    const { mission_id } = req.body;
    if (!mission_id) return res.status(400).json({ error: 'mission_id is required' });

    // Verify mission is public
    const missionResult = await query('SELECT id, name, is_public FROM missions WHERE id = $1', [mission_id]);
    if (missionResult.rows.length === 0) return res.status(404).json({ error: 'Mission not found' });
    if (!missionResult.rows[0].is_public) return res.status(403).json({ error: 'Mission is not public' });

    // Check if already a member
    const existing = await query('SELECT 1 FROM mission_members WHERE mission_id = $1 AND user_id = $2', [mission_id, req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Already a member of this mission' });

    // Add as member with teamlead role (lowest permission)
    await query(
      `INSERT INTO mission_members (mission_id, user_id, role, mission_role) VALUES ($1, $2, 'member', 'teamlead')`,
      [mission_id, req.user.id]
    );

    broadcastToMission(mission_id, 'member:accepted', { user_id: req.user.id, mission_role: 'teamlead' });

    res.status(201).json({ message: `Joined "${missionResult.rows[0].name}"` });
  } catch (err) { next(err); }
});

module.exports = router;
