/**
 * Socket.IO client wrapper with auto-reconnect and offline handling
 */
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useMissionStore } from '../stores/missionStore';

let socket = null;
let connectionStatus = 'disconnected'; // 'connected' | 'disconnected' | 'reconnecting'
const statusListeners = new Set();

export function onConnectionStatusChange(cb) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

export function getConnectionStatus() {
  return connectionStatus;
}

function setStatus(s) {
  connectionStatus = s;
  statusListeners.forEach((cb) => cb(s));
}

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
    setStatus('connected');
    toast.success('Connected to server');
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
          if (data.contacts?.length) data.contacts.forEach((c) => store.updateContact(c));
          if (data.tasks?.length) data.tasks.forEach((t) => store.updateTask(t));
          store.setLastSyncTime(data.server_time);
        })
        .catch(() => {});
    }
  });

  socket.on('disconnect', () => {
    console.log('[KRT] WebSocket disconnected');
    setStatus('disconnected');
    toast.error('Disconnected — reconnecting…');
  });

  socket.io.on('reconnect_attempt', () => {
    setStatus('reconnecting');
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
  socket.on('waypoints:cleared', ({ unit_id }) => useMissionStore.getState().clearWaypoints(unit_id));

  // Contact events
  socket.on('contact:created', (contact) => useMissionStore.getState().addContact(contact));
  socket.on('contact:updated', (contact) => useMissionStore.getState().updateContact(contact));
  socket.on('contact:deleted', ({ id }) => useMissionStore.getState().removeContact(id));

  // Task events
  socket.on('task:created', (task) => useMissionStore.getState().addTask(task));
  socket.on('task:updated', (task) => useMissionStore.getState().updateTask(task));
  socket.on('task:deleted', ({ id }) => useMissionStore.getState().removeTask(id));

  // Operation events
  socket.on('operation:created', (op) => useMissionStore.getState().addOperation(op));
  socket.on('operation:updated', (op) => useMissionStore.getState().updateOperation(op));
  socket.on('operation:deleted', ({ id }) => useMissionStore.getState().removeOperation(id));

  // Event log
  socket.on('event:created', (event) => useMissionStore.getState().addEvent(event));

  // Quick messages
  socket.on('message:created', (msg) => useMissionStore.getState().addMessage(msg));

  socket.on('team:online', (users) => useMissionStore.getState().setOnlineUsers(users));

  // Member / join request events
  socket.on('member:join_request', (jr) => {
    useMissionStore.getState().addJoinRequest(jr);
    toast(`${jr.username || 'Someone'} wants to join the mission`, { icon: '👋' });
  });
  socket.on('member:accepted', () => {
    // Could refresh members but for now the accepting client already updated the store
  });
  socket.on('member:declined', ({ requestId }) => {
    useMissionStore.getState().removeJoinRequest(requestId);
  });
  socket.on('member:removed', ({ user_id }) => {
    useMissionStore.getState().removeMember(user_id);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    setStatus('disconnected');
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
