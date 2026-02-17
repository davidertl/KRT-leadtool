/**
 * Discord OAuth2 Passport Strategy
 */

const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { query } = require('../db/postgres');

const scopes = ['identify'];

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: scopes,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Upsert user in database
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
        profile.id,
        profile.username,
        profile.discriminator || '0',
        profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null,
      ]
    );

    return done(null, result.rows[0]);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});
