/**
 * Discord Role → Mission Role sync.
 *
 * Gesamtlead can:
 *  1. Set a Discord guild ID for the mission
 *  2. Define discord_role_id → mission_role mappings
 *  3. Run a sync: for each mission member with a discord_id, fetch their
 *     guild roles via the Discord bot API and auto-assign their mission role.
 *
 * Requires DISCORD_BOT_TOKEN in .env for the sync operation.
 */

const router = require('express').Router({ mergeParams: true });
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { requireMissionMember, requireGesamtlead } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');

// Map :id → :mission_id for requireMissionMember compatibility
router.use((req, _res, next) => {
  if (req.params.id && !req.params.mission_id) req.params.mission_id = req.params.id;
  next();
});

const DISCORD_API = 'https://discord.com/api/v10';

// GET /api/missions/:id/discord-roles — get current guild ID and role mappings
router.get('/', requireAuth, requireMissionMember, async (req, res, next) => {
  try {
    const missionResult = await query(
      'SELECT id, discord_guild_id FROM missions WHERE id = $1',
      [req.params.id]
    );
    if (missionResult.rows.length === 0) return res.status(404).json({ error: 'Mission not found' });

    const mappings = await query(
      'SELECT * FROM discord_role_mappings WHERE mission_id = $1 ORDER BY discord_role_name ASC',
      [req.params.id]
    );

    res.json({
      discord_guild_id: missionResult.rows[0].discord_guild_id || null,
      mappings: mappings.rows,
    });
  } catch (err) { next(err); }
});

// PUT /api/missions/:id/discord-roles — update guild ID and role mappings (gesamtlead only)
router.put('/', requireAuth, requireMissionMember, requireGesamtlead, async (req, res, next) => {
  try {
    const { discord_guild_id, mappings } = req.body;

    // Update guild ID on mission
    await query(
      'UPDATE missions SET discord_guild_id = $1, updated_at = NOW() WHERE id = $2',
      [discord_guild_id || null, req.params.id]
    );

    if (Array.isArray(mappings)) {
      // Replace all mappings for this mission
      await query('DELETE FROM discord_role_mappings WHERE mission_id = $1', [req.params.id]);
      for (const mapping of mappings) {
        if (!mapping.discord_role_id || !mapping.mission_role) continue;
        await query(
          `INSERT INTO discord_role_mappings (mission_id, discord_role_id, discord_role_name, mission_role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (mission_id, discord_role_id) DO UPDATE
             SET discord_role_name = EXCLUDED.discord_role_name,
                 mission_role = EXCLUDED.mission_role`,
          [req.params.id, mapping.discord_role_id, mapping.discord_role_name || null, mapping.mission_role]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/missions/:id/discord-roles/guild-roles — fetch available roles from Discord guild
router.get('/guild-roles', requireAuth, requireMissionMember, requireGesamtlead, async (req, res, next) => {
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return res.status(503).json({ error: 'DISCORD_BOT_TOKEN not configured' });

    const missionResult = await query(
      'SELECT discord_guild_id FROM missions WHERE id = $1',
      [req.params.id]
    );
    const guildId = missionResult.rows[0]?.discord_guild_id;
    if (!guildId) return res.status(400).json({ error: 'No Discord guild configured for this mission' });

    const resp = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err.message || 'Discord API error' });
    }

    const roles = await resp.json();
    const filtered = roles
      .filter((r) => !r.managed && r.name !== '@everyone')
      .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
      .sort((a, b) => b.position - a.position);

    res.json(filtered);
  } catch (err) { next(err); }
});

// POST /api/missions/:id/discord-roles/sync — sync all member roles via Discord bot
router.post('/sync', requireAuth, requireMissionMember, requireGesamtlead, async (req, res, next) => {
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) return res.status(503).json({ error: 'DISCORD_BOT_TOKEN not configured' });

    const missionResult = await query(
      'SELECT discord_guild_id FROM missions WHERE id = $1',
      [req.params.id]
    );
    const guildId = missionResult.rows[0]?.discord_guild_id;
    if (!guildId) return res.status(400).json({ error: 'No Discord guild configured for this mission' });

    // Load role mappings
    const mappingsResult = await query(
      'SELECT discord_role_id, mission_role FROM discord_role_mappings WHERE mission_id = $1',
      [req.params.id]
    );
    if (mappingsResult.rows.length === 0) {
      return res.status(400).json({ error: 'No role mappings configured for this mission' });
    }

    const roleMap = {};
    for (const row of mappingsResult.rows) {
      roleMap[row.discord_role_id] = row.mission_role;
    }

    // Load mission members with discord_id
    const members = await query(
      `SELECT mm.user_id, mm.mission_role, u.discord_id, u.username
       FROM mission_members mm
       JOIN users u ON u.id = mm.user_id
       WHERE mm.mission_id = $1 AND u.discord_id IS NOT NULL`,
      [req.params.id]
    );

    const updated = [];
    const failed = [];

    for (const member of members.rows) {
      try {
        const memberResp = await fetch(
          `${DISCORD_API}/guilds/${guildId}/members/${member.discord_id}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );

        if (!memberResp.ok) {
          failed.push({ username: member.username, reason: `Discord ${memberResp.status}` });
          continue;
        }

        const guildMember = await memberResp.json();
        const memberRoles = guildMember.roles || [];

        // Find highest-priority mapped role (gesamtlead > gruppenlead > teamlead)
        const PRIORITY = { gesamtlead: 3, gruppenlead: 2, teamlead: 1 };
        let bestRole = null;
        let bestPriority = 0;

        for (const discordRoleId of memberRoles) {
          const mappedRole = roleMap[discordRoleId];
          if (mappedRole && (PRIORITY[mappedRole] || 0) > bestPriority) {
            bestRole = mappedRole;
            bestPriority = PRIORITY[mappedRole] || 0;
          }
        }

        if (bestRole && bestRole !== member.mission_role) {
          await query(
            `UPDATE mission_members SET mission_role = $1 WHERE mission_id = $2 AND user_id = $3`,
            [bestRole, req.params.id, member.user_id]
          );

          broadcastToMission(req.params.id, 'member:updated', {
            user_id: member.user_id,
            mission_role: bestRole,
          });

          updated.push({ username: member.username, old: member.mission_role, new: bestRole });
        }
      } catch {
        failed.push({ username: member.username, reason: 'Request failed' });
      }
    }

    res.json({ ok: true, updated, failed, total: members.rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
