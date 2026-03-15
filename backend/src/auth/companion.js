/**
 * Companion device auth helpers and Discord OAuth flow.
 */

const crypto = require('crypto');
const { query } = require('../db/postgres');
const { generateToken, verifyToken } = require('./jwt');

const COMPANION_TOKEN_SCOPES = Object.freeze(['companion', 'voice', 'status']);
const pendingStates = new Map();

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function cleanupPendingStates() {
  const cutoff = Date.now() - (5 * 60 * 1000);
  for (const [state, entry] of pendingStates.entries()) {
    if ((entry?.createdAt || 0) < cutoff) {
      pendingStates.delete(state);
    }
  }
}

setInterval(cleanupPendingStates, 60 * 1000).unref();

function beginPendingState(state) {
  pendingStates.set(state, { status: 'pending', createdAt: Date.now() });
}

function consumePendingState(state) {
  const value = pendingStates.get(state);
  pendingStates.delete(state);
  return value;
}

function getPendingState(state) {
  return pendingStates.get(state);
}

async function createCompanionSession(user, meta = {}) {
  const sessionId = crypto.randomUUID();
  const token = generateToken(user, {
    tokenType: 'companion',
    scopes: COMPANION_TOKEN_SCOPES,
    sessionId,
    expiresIn: '24h',
  });
  const tokenHash = hashToken(token);

  const result = await query(
    `INSERT INTO companion_sessions (
       id, user_id, token_hash, session_name, scopes, created_at, last_seen_at, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW() + INTERVAL '24 hours')
     RETURNING id, user_id, session_name, scopes, expires_at`,
    [
      sessionId,
      user.id,
      tokenHash,
      meta.sessionName || meta.deviceName || 'Companion App',
      JSON.stringify(COMPANION_TOKEN_SCOPES),
    ]
  );

  return {
    token,
    session: result.rows[0],
  };
}

async function revokeCompanionSession(sessionId, userId) {
  const result = await query(
    `UPDATE companion_sessions
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );

  return result.rowCount > 0;
}

async function verifyCompanionRequest(req) {
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return null;
  }

  if (payload.token_type !== 'companion' || !payload.session_id) {
    return null;
  }

  const tokenHash = hashToken(token);
  const sessionResult = await query(
    `SELECT cs.*, u.discord_id, u.username, u.role
     FROM companion_sessions cs
     JOIN users u ON u.id = cs.user_id
     WHERE cs.id = $1
       AND cs.user_id = $2
       AND cs.token_hash = $3
       AND cs.revoked_at IS NULL
       AND cs.expires_at > NOW()`,
    [payload.session_id, payload.id, tokenHash]
  );

  const session = sessionResult.rows[0];
  if (!session) return null;

  await query(
    `UPDATE companion_sessions SET last_seen_at = NOW() WHERE id = $1`,
    [session.id]
  ).catch(() => {});

  return {
    token,
    payload,
    session,
    user: {
      id: payload.id,
      discord_id: session.discord_id,
      username: payload.username,
      role: payload.role,
      token_type: payload.token_type,
      scopes: payload.scopes || [],
      session_id: payload.session_id,
    },
  };
}

function requireCompanionAuth(requiredScopes = []) {
  return async (req, res, next) => {
    try {
      const verified = await verifyCompanionRequest(req);
      if (!verified) {
        return res.status(401).json({ error: 'Valid companion token required' });
      }

      const grantedScopes = new Set(verified.user.scopes || []);
      const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
      if (missingScopes.length > 0) {
        return res.status(403).json({ error: `Missing companion scopes: ${missingScopes.join(', ')}` });
      }

      req.user = verified.user;
      req.authToken = verified.token;
      req.companionSession = verified.session;
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function exchangeDiscordCode({ code, redirectUri }) {
  const tokenResp = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error('Discord token exchange failed');
  }

  const userResp = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const discordUser = await userResp.json();
  if (!discordUser.id) {
    throw new Error('Discord user lookup failed');
  }

  try {
    await fetch('https://discord.com/api/v10/oauth2/token/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: tokenData.access_token,
        token_type_hint: 'access_token',
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
      }),
    });
  } catch {
    // Best effort only.
  }

  return discordUser;
}

async function upsertDiscordUser(discordUser) {
  const username = discordUser.global_name || discordUser.username || discordUser.id;
  const result = await query(
    `INSERT INTO users (discord_id, username, discriminator, avatar_url, last_login_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (discord_id)
     DO UPDATE SET
       username = EXCLUDED.username,
       discriminator = EXCLUDED.discriminator,
       avatar_url = EXCLUDED.avatar_url,
       last_login_at = NOW()
     RETURNING *`,
    [
      discordUser.id,
      username,
      discordUser.discriminator || '0',
      discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
    ]
  );

  return result.rows[0];
}

module.exports = {
  COMPANION_TOKEN_SCOPES,
  beginPendingState,
  consumePendingState,
  createCompanionSession,
  exchangeDiscordCode,
  getPendingState,
  requireCompanionAuth,
  revokeCompanionSession,
  upsertDiscordUser,
};
