/**
 * Radio Net Monitor — read-only frequency landscape for web lead view.
 * The actual audio relay is handled by the voice module (companion app).
 */

const router = require('express').Router();
const { query } = require('../db/postgres');
const { requireAuth } = require('../auth/jwt');
const { ensureMissionMember } = require('../auth/teamAuth');

// GET /api/radio/net?mission_id=X
// Returns: frequencies in use, listener counts, recent TX events
router.get('/net', requireAuth, async (req, res, next) => {
  try {
    const { mission_id } = req.query;
    if (!mission_id) return res.status(400).json({ error: 'mission_id required' });

    const isMember = await ensureMissionMember({ user: req.user }, mission_id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this mission' });

    // Frequencies from units in this mission
    const unitFreqs = await query(
      `SELECT id, name, callsign, vhf_frequency, group_id
       FROM units
       WHERE mission_id = $1 AND vhf_frequency IS NOT NULL
       ORDER BY vhf_frequency ASC`,
      [mission_id]
    );

    // Frequencies from groups in this mission
    const groupFreqs = await query(
      `SELECT id, name, color, vhf_channel
       FROM groups
       WHERE mission_id = $1 AND vhf_channel IS NOT NULL
       ORDER BY name ASC`,
      [mission_id]
    );

    // Active voice listeners per frequency (from voice relay state in DB)
    const listeners = await query(
      `SELECT vfl.freq_id, COUNT(*) AS listener_count,
              array_agg(u.username ORDER BY u.username) AS listeners
       FROM voice_freq_listeners vfl
       JOIN voice_sessions vs ON vs.session_token_hash = vfl.session_token_hash
       JOIN users u ON u.id = vfl.user_id
       GROUP BY vfl.freq_id`
    );

    const listenerMap = {};
    for (const row of listeners.rows) {
      listenerMap[row.freq_id] = {
        count: parseInt(row.listener_count, 10),
        users: row.listeners || [],
      };
    }

    // Recent TX events (last 50 across all frequencies)
    const txEvents = await query(
      `SELECT vte.id, vte.freq_id, vte.action, vte.radio_slot, vte.created_at,
              u.username, u.id AS user_id
       FROM voice_tx_events vte
       JOIN users u ON u.id = vte.user_id
       WHERE vte.created_at > NOW() - INTERVAL '1 hour'
       ORDER BY vte.created_at DESC
       LIMIT 50`
    );

    res.json({
      unitFrequencies: unitFreqs.rows,
      groupChannels: groupFreqs.rows,
      listenerCounts: listenerMap,
      recentTx: txEvents.rows,
    });
  } catch (err) { next(err); }
});

// POST /api/radio/transmit (text broadcast on a frequency via web lead)
router.post('/transmit', requireAuth, async (req, res, next) => {
  try {
    const { mission_id, freq_id, message } = req.body;
    if (!mission_id || !freq_id || !message) {
      return res.status(400).json({ error: 'mission_id, freq_id, and message required' });
    }

    const isMember = await ensureMissionMember({ user: req.user }, mission_id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this mission' });

    const { broadcastToMission } = require('../socket');
    broadcastToMission(mission_id, 'radio:message', {
      freq_id: Number(freq_id),
      message,
      username: req.user.username,
      user_id: req.user.id,
      ts: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
