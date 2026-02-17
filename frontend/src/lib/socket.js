/**
 * Socket.IO client wrapper with auto-reconnect and offline handling
 */
import { io } from 'socket.io-client';
import { useMissionStore } from '../stores/missionStore';

let socket = null;

export function connectSocket(teamId) {
  if (socket?.connected) {
    socket.emit('team:leave', socket._currentTeam);
  }

  socket = io({
    path: '/socket.io/',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });

  socket._currentTeam = teamId;

  socket.on('connect', () => {
    console.log('[KRT] WebSocket connected');
    socket.emit('team:join', teamId);

    // Delta sync on reconnect
    const lastSync = useMissionStore.getState().lastSyncTime;
    if (lastSync) {
      fetch(`/api/sync?team_id=${teamId}&since=${lastSync}`, { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          const store = useMissionStore.getState();
          if (data.units?.length) data.units.forEach((u) => store.updateUnit(u));
          if (data.groups?.length) data.groups.forEach((g) => store.updateGroup(g));
          store.setLastSyncTime(data.server_time);
        })
        .catch(() => {});
    }
  });

  socket.on('disconnect', () => {
    console.log('[KRT] WebSocket disconnected');
  });

  // Real-time event handlers
  socket.on('unit:created', (unit) => useMissionStore.getState().addUnit(unit));
  socket.on('unit:updated', (unit) => useMissionStore.getState().updateUnit(unit));
  socket.on('unit:deleted', ({ id }) => useMissionStore.getState().removeUnit(id));
  socket.on('unit:moved', (data) => useMissionStore.getState().updateUnit(data));

  socket.on('group:created', (group) => useMissionStore.getState().addGroup(group));
  socket.on('group:updated', (group) => useMissionStore.getState().updateGroup(group));
  socket.on('group:deleted', ({ id }) => useMissionStore.getState().removeGroup(id));

  socket.on('waypoint:created', (wp) => useMissionStore.getState().addWaypoint(wp));
  socket.on('waypoint:deleted', ({ id }) => useMissionStore.getState().removeWaypoint(id));

  socket.on('team:online', (users) => useMissionStore.getState().setOnlineUsers(users));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

/**
 * Emit a real-time unit move event (for drag without persisting)
 */
export function emitUnitMove(data) {
  if (socket?.connected) {
    socket.emit('unit:move', data);
  }
}
