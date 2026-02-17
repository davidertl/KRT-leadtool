/**
 * Authentication routes (Discord OAuth2 + JWT)
 */

const router = require('express').Router();
const passport = require('passport');
const { generateToken, requireAuth } = require('../auth/jwt');

// Redirect to Discord login
router.get('/discord', passport.authenticate('discord'));

// Discord callback → issue JWT
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/api/auth/failed' }),
  (req, res) => {
    const token = generateToken(req.user);

    // Set JWT as httpOnly cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend
    res.redirect(process.env.APP_URL || '/');
  }
);

// Get current user info
router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    discord_id: req.user.discord_id,
    role: req.user.role,
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('jwt');
  req.logout?.(() => {});
  res.json({ message: 'Logged out' });
});

// Auth failed
router.get('/failed', (req, res) => {
  res.status(401).json({ error: 'Discord authentication failed' });
});

module.exports = router;
