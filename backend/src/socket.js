/**
 * Socket.IO - Real-time WebSocket communication
 */

const { Server } = require('socket.io');
const { verifyToken } = require('./auth/jwt');
const { valkey } = require('./db/valkey');

let io = null;

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.APP_URL || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.cookie?.match(/jwt=([^;]+)/)?.[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const user = verifyToken(token);
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[KRT] Socket connected: ${socket.user.username} (${socket.id})`);

    // Join team room
    socket.on('team:join', (teamId) => {
      socket.join(`team:${teamId}`);
      console.log(`[KRT] ${socket.user.username} joined team:${teamId}`);

      // Publish presence to Valkey
      valkey.hset(`online:${teamId}`, socket.user.id, JSON.stringify({
        username: socket.user.username,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
      })).catch(() => {});

      // Broadcast updated online list
      broadcastOnlineUsers(teamId);
    });

    // Leave team room
    socket.on('team:leave', (teamId) => {
      socket.leave(`team:${teamId}`);
      valkey.hdel(`online:${teamId}`, socket.user.id).catch(() => {});
      broadcastOnlineUsers(teamId);
    });

    // Real-time unit position update (for smooth drag)
    socket.on('unit:move', (data) => {
      // Broadcast to team without persisting (persist on drop via REST)
      if (data.team_id) {
        socket.to(`team:${data.team_id}`).emit('unit:moved', {
          id: data.id,
          pos_x: data.pos_x,
          pos_y: data.pos_y,
          pos_z: data.pos_z,
          heading: data.heading,
        });
      }
    });

    // Cursor/selection sharing for collaborative awareness
    socket.on('cursor:update', (data) => {
      if (data.team_id) {
        socket.to(`team:${data.team_id}`).emit('cursor:updated', {
          user_id: socket.user.id,
          username: socket.user.username,
          ...data,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[KRT] Socket disconnected: ${socket.user.username} (${socket.id})`);

      // Remove from all team rooms' online lists
      socket.rooms.forEach((room) => {
        if (room.startsWith('team:')) {
          const teamId = room.replace('team:', '');
          valkey.hdel(`online:${teamId}`, socket.user.id).catch(() => {});
          broadcastOnlineUsers(teamId);
        }
      });
    });
  });

  console.log('[KRT] Socket.IO initialized');
}

/**
 * Broadcast an event to all connected clients in a team room
 */
function broadcastToTeam(teamId, event, data) {
  if (io) {
    io.to(`team:${teamId}`).emit(event, data);
  }
}

/**
 * Broadcast the list of online users in a team
 */
async function broadcastOnlineUsers(teamId) {
  try {
    const online = await valkey.hgetall(`online:${teamId}`);
    const users = Object.entries(online).map(([id, json]) => ({
      id,
      ...JSON.parse(json),
    }));
    if (io) {
      io.to(`team:${teamId}`).emit('team:online', users);
    }
  } catch {
    // Ignore errors
  }
}

module.exports = { initSocketIO, broadcastToTeam };
