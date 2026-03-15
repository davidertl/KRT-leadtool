/**
 * Raw WebSocket voice relay used by the Companion App.
 *
 * Audio frames are forwarded as opaque binary payloads. The relay only inspects
 * the 8-byte `[freqId][sequence]` prefix so end-to-end encrypted voice data can
 * pass through without server-side decryption.
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { verifyToken } = require('../../auth/jwt');

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createVoiceRelay({ query, valkey }) {
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map();
  const freqSubscribers = new Map();
  const freqKeys = new Map();

  async function persistSession(sessionToken, session) {
    const tokenHash = hashSessionToken(sessionToken);
    await query(
      `INSERT INTO voice_sessions (session_token_hash, user_id, username, created_at, last_seen_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (session_token_hash)
       DO UPDATE SET username = EXCLUDED.username, last_seen_at = NOW()`,
      [tokenHash, session.userId, session.username]
    );
  }

  async function removePersistedSession(sessionToken) {
    await query(
      `DELETE FROM voice_sessions WHERE session_token_hash = $1`,
      [hashSessionToken(sessionToken)]
    ).catch(() => {});
  }

  async function persistListener(sessionToken, session, freqId, radioSlot = 0) {
    await query(
      `INSERT INTO voice_freq_listeners (session_token_hash, user_id, freq_id, radio_slot, joined_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (session_token_hash, freq_id)
       DO UPDATE SET radio_slot = EXCLUDED.radio_slot, joined_at = NOW()`,
      [hashSessionToken(sessionToken), session.userId, freqId, radioSlot]
    ).catch(() => {});
  }

  async function removePersistedListener(sessionToken, freqId) {
    await query(
      `DELETE FROM voice_freq_listeners WHERE session_token_hash = $1 AND freq_id = $2`,
      [hashSessionToken(sessionToken), freqId]
    ).catch(() => {});
  }

  async function mirrorFreqState(freqId) {
    const subscribers = freqSubscribers.get(freqId);
    const count = subscribers?.size || 0;
    await valkey.set(`voice:freq:${freqId}:count`, String(count), 'EX', 120).catch(() => {});
  }

  function getListenerCount(freqId) {
    return freqSubscribers.get(Number(freqId))?.size || 0;
  }

  async function updateSessionHeartbeat(sessionToken) {
    const session = sessions.get(sessionToken);
    if (!session) return;
    session.lastSeen = Date.now();
    await query(
      `UPDATE voice_sessions SET last_seen_at = NOW() WHERE session_token_hash = $1`,
      [hashSessionToken(sessionToken)]
    ).catch(() => {});
  }

  function send(ws, payload) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  async function handleAuth(ws, msg, setToken) {
    if (!msg.authToken) {
      send(ws, { type: 'auth_error', reason: 'missing auth token' });
      return;
    }

    let payload;
    try {
      payload = verifyToken(msg.authToken);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[voice] Auth verify failed:', err.message);
      }
      send(ws, { type: 'auth_error', reason: 'invalid or expired token' });
      return;
    }

    if (!payload.id || !payload.username) {
      send(ws, { type: 'auth_error', reason: 'invalid token payload' });
      return;
    }

    const sessionToken = crypto.randomBytes(24).toString('hex');
    const activeCount = Array.from(sessions.values()).filter((session) => session.userId === payload.id).length;
    if (activeCount >= 3) {
      send(ws, { type: 'auth_error', reason: 'too many concurrent sessions' });
      return;
    }

    const session = {
      userId: payload.id,
      username: payload.username,
      tokenType: payload.token_type || 'web',
      ws,
      frequencies: new Set(),
      mutedFreqs: new Set(),
      lastSeen: Date.now(),
    };

    sessions.set(sessionToken, session);
    setToken(sessionToken);
    await persistSession(sessionToken, session);
    await valkey.set(`voice:session:${sessionToken}`, payload.id, 'EX', 120).catch(() => {});

    send(ws, {
      type: 'auth_ok',
      sessionToken,
      displayName: payload.username,
    });
  }

  async function handleJoin(sessionToken, msg) {
    const session = sessions.get(sessionToken);
    if (!session) return;

    const freqId = Number(msg.freqId);
    if (!Number.isInteger(freqId) || freqId < 1000 || freqId > 9999) {
      send(session.ws, { type: 'join_error', reason: 'bad freqId' });
      return;
    }

    session.frequencies.add(freqId);
    if (!freqSubscribers.has(freqId)) freqSubscribers.set(freqId, new Set());
    freqSubscribers.get(freqId).add(sessionToken);

    if (!freqKeys.has(freqId)) {
      freqKeys.set(freqId, crypto.randomBytes(32));
    }

    await persistListener(sessionToken, session, freqId, Number(msg.radioSlot) || 0);
    await mirrorFreqState(freqId);

    const listenerCount = getListenerCount(freqId);
    send(session.ws, {
      type: 'join_ok',
      freqId,
      listenerCount,
      freqKey: freqKeys.get(freqId).toString('base64'),
    });

    for (const subscriberToken of freqSubscribers.get(freqId)) {
      if (subscriberToken === sessionToken) continue;
      const subscriber = sessions.get(subscriberToken);
      if (subscriber) {
        send(subscriber.ws, { type: 'listener_update', freqId, listenerCount });
      }
    }
  }

  async function handleLeave(sessionToken, msg) {
    const session = sessions.get(sessionToken);
    if (!session) return;

    const freqId = Number(msg.freqId);
    session.frequencies.delete(freqId);
    session.mutedFreqs.delete(freqId);

    const subscribers = freqSubscribers.get(freqId);
    if (subscribers) {
      subscribers.delete(sessionToken);
      if (subscribers.size === 0) {
        freqSubscribers.delete(freqId);
        freqKeys.delete(freqId);
      }
    }

    await removePersistedListener(sessionToken, freqId);
    await mirrorFreqState(freqId);

    send(session.ws, { type: 'leave_ok', freqId });

    const remainingCount = getListenerCount(freqId);
    const remainingSubscribers = freqSubscribers.get(freqId) || new Set();
    for (const subscriberToken of remainingSubscribers) {
      const subscriber = sessions.get(subscriberToken);
      if (subscriber) {
        send(subscriber.ws, { type: 'listener_update', freqId, listenerCount: remainingCount });
      }
    }
  }

  function handleMute(sessionToken, msg, muted) {
    const session = sessions.get(sessionToken);
    if (!session) return;

    const freqId = Number(msg.freqId);
    if (!Number.isInteger(freqId) || freqId < 1000 || freqId > 9999) {
      send(session.ws, { type: 'mute_error', reason: 'bad freqId' });
      return;
    }

    if (muted) session.mutedFreqs.add(freqId);
    else session.mutedFreqs.delete(freqId);

    send(session.ws, { type: 'mute_ok', freqId, muted });
  }

  function handleAudio(sessionToken, buffer) {
    if (buffer.length < 9) return;

    const freqId = buffer.readUInt32BE(0);
    const sender = sessions.get(sessionToken);
    if (!sender || !sender.frequencies.has(freqId)) return;

    const subscribers = freqSubscribers.get(freqId);
    if (!subscribers) return;

    for (const subscriberToken of subscribers) {
      if (subscriberToken === sessionToken) continue;
      const subscriber = sessions.get(subscriberToken);
      if (!subscriber || subscriber.mutedFreqs.has(freqId) || subscriber.ws.readyState !== 1) continue;
      subscriber.ws.send(buffer);
    }
  }

  async function cleanupSession(sessionToken) {
    const session = sessions.get(sessionToken);
    if (!session) return;

    for (const freqId of session.frequencies) {
      const subscribers = freqSubscribers.get(freqId);
      if (subscribers) {
        subscribers.delete(sessionToken);
        if (subscribers.size === 0) {
          freqSubscribers.delete(freqId);
          freqKeys.delete(freqId);
        }
      }

      await removePersistedListener(sessionToken, freqId);
      await mirrorFreqState(freqId);
    }

    sessions.delete(sessionToken);
    await valkey.del(`voice:session:${sessionToken}`).catch(() => {});
    await removePersistedSession(sessionToken);
  }

  function notifyTxEvent(payload) {
    const freqId = Number(payload.freqId);
    const subscribers = freqSubscribers.get(freqId);
    if (!subscribers) return;

    const eventPayload = JSON.stringify({
      type: 'rx',
      freqId,
      action: payload.action,
      userId: payload.userId,
      username: payload.username,
    });

    for (const subscriberToken of subscribers) {
      const subscriber = sessions.get(subscriberToken);
      if (!subscriber || subscriber.userId === payload.userId || subscriber.ws.readyState !== 1) continue;
      subscriber.ws.send(eventPayload);
    }
  }

  function start() {
    wss.on('connection', (ws) => {
      let sessionToken = null;

      ws.on('message', async (raw, isBinary) => {
        if (isBinary) {
          if (sessionToken) handleAudio(sessionToken, raw);
          return;
        }

        let msg;
        try {
          msg = JSON.parse(raw.toString('utf-8'));
        } catch {
          return;
        }

        switch (msg.type) {
          case 'auth':
            await handleAuth(ws, msg, (token) => { sessionToken = token; });
            break;
          case 'join':
            if (sessionToken) await handleJoin(sessionToken, msg);
            break;
          case 'leave':
            if (sessionToken) await handleLeave(sessionToken, msg);
            break;
          case 'mute':
            if (sessionToken) handleMute(sessionToken, msg, true);
            break;
          case 'unmute':
            if (sessionToken) handleMute(sessionToken, msg, false);
            break;
          case 'ping':
            if (sessionToken) {
              await updateSessionHeartbeat(sessionToken);
              send(ws, { type: 'pong' });
            }
            break;
          default:
            break;
        }
      });

      ws.on('close', () => {
        if (sessionToken) cleanupSession(sessionToken).catch(() => {});
      });

      ws.on('error', () => {
        if (sessionToken) cleanupSession(sessionToken).catch(() => {});
      });
    });

    setInterval(() => {
      const cutoff = Date.now() - 60_000;
      for (const [sessionToken, session] of sessions.entries()) {
        if (session.lastSeen < cutoff) {
          try {
            session.ws.close(4000, 'timeout');
          } catch {
            // ignore close errors
          }
          cleanupSession(sessionToken).catch(() => {});
        }
      }
    }, 30_000).unref();
  }

  return {
    start,
    notifyTxEvent,
    getListenerCount,
    handleUpgrade(req, socket, head) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    },
  };
}

module.exports = { createVoiceRelay };
