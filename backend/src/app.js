/**
 * Express Application Setup
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const passport = require('passport');
const { valkey } = require('./db/valkey');

// Route imports
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const teamsRoutes = require('./routes/teams');
const unitsRoutes = require('./routes/units');
const groupsRoutes = require('./routes/groups');
const waypointsRoutes = require('./routes/waypoints');
const historyRoutes = require('./routes/history');
const syncRoutes = require('./routes/sync');
const contactsRoutes = require('./routes/contacts');
const tasksRoutes = require('./routes/tasks');
const shipImageRoutes = require('./routes/shipImages');
const navigationRoutes = require('./routes/navigation');
const operationsRoutes = require('./routes/operations');
const eventsRoutes = require('./routes/events');
const messagesRoutes = require('./routes/messages');
const bookmarksRoutes = require('./routes/bookmarks');

// Passport config
require('./auth/discord');

const app = express();

// ---- Middleware ----
app.use(helmet({ contentSecurityPolicy: false })); // CSP handled by Nginx
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session (needed for Passport OAuth2 flow) — backed by Valkey (Redis-compatible)
app.use(session({
  store: new RedisStore({ client: valkey, prefix: 'krt:sess:' }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ---- Routes ----
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/waypoints', waypointsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/ship-images', shipImageRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/bookmarks', bookmarksRoutes);

// ---- Error handler ----
app.use((err, req, res, _next) => {
  console.error('[KRT] Error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

module.exports = app;
