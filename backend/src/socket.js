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

    // Join mission room
    socket.on('mission:join', (missionId) => {
      socket.join(`mission:${missionId}`);
      console.log(`[KRT] ${socket.user.username} joined mission:${missionId}`);

      // Publish presence to Valkey
      valkey.hset(`online:${missionId}`, socket.user.id, JSON.stringify({
        username: socket.user.username,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
      })).catch(() => {});

      // Broadcast updated online list
      broadcastOnlineUsers(missionId);
    });

    // Leave mission room
    socket.on('mission:leave', (missionId) => {
      socket.leave(`mission:${missionId}`);
      valkey.hdel(`online:${missionId}`, socket.user.id).catch(() => {});
      broadcastOnlineUsers(missionId);
    });

    // Real-time unit position update (for smooth drag)
    socket.on('unit:move', (data) => {
      // Broadcast to mission without persisting (persist on drop via REST)
      if (data.mission_id) {
        socket.to(`mission:${data.mission_id}`).emit('unit:moved', {
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
      if (data.mission_id) {
        socket.to(`mission:${data.mission_id}`).emit('cursor:updated', {
          user_id: socket.user.id,
          username: socket.user.username,
          ...data,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[KRT] Socket disconnected: ${socket.user.username} (${socket.id})`);

      // Remove from all mission rooms' online lists
      socket.rooms.forEach((room) => {
        if (room.startsWith('mission:')) {
          const missionId = room.replace('mission:', '');
          valkey.hdel(`online:${missionId}`, socket.user.id).catch(() => {});
          broadcastOnlineUsers(missionId);
        }
      });
    });
  });

  console.log('[KRT] Socket.IO initialized');
}

/**
 * Broadcast an event to all connected clients in a mission room
 */
function broadcastToMission(missionId, event, data) {
  if (io) {
    io.to(`mission:${missionId}`).emit(event, data);
  }
}

/**
 * Broadcast the list of online users in a mission
 */
async function broadcastOnlineUsers(missionId) {
  try {
    const online = await valkey.hgetall(`online:${missionId}`);
    const users = Object.entries(online).map(([id, json]) => ({
      id,
      ...JSON.parse(json),
    }));
    if (io) {
      io.to(`mission:${missionId}`).emit('mission:online', users);
    }
  } catch {
    // Ignore errors
  }
}

module.exports = { initSocketIO, broadcastToMission };
