/**
 * Mission/Map state store (Zustand)
 * Manages units, groups, waypoints, contacts, tasks, operations, events, messages, bookmarks, navData
 */
import { create } from 'zustand';
import { db } from '../lib/offlineDb';

export const useMissionStore = create((set, get) => ({
  teamId: null,
  units: [],
  groups: [],
  waypoints: [],
  contacts: [],
  tasks: [],
  operations: [],
  events: [],
  messages: [],
  bookmarks: [],
  navData: { systems: [], bodies: [], points: [], edges: [] },
  onlineUsers: [],
  selectedUnitIds: [],
  lastSyncTime: null,
  focusedUnitId: null,
  searchQuery: '',
  statusFilter: null,
  activeSystemId: null,

  setTeamId: (teamId) => set({ teamId }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setStatusFilter: (s) => set({ statusFilter: s }),
  focusUnit: (id) => set({ focusedUnitId: id }),
  clearFocus: () => set({ focusedUnitId: null }),
  setActiveSystemId: (id) => set({ activeSystemId: id }),

  // ---- Units ----
  setUnits: (units) => {
    set({ units });
    // Cache offline
    db.units.bulkPut(units).catch(() => {});
  },

  addUnit: (unit) => set((s) => {
    const units = [...s.units.filter((u) => u.id !== unit.id), unit];
    db.units.put(unit).catch(() => {});
    return { units };
  }),

  updateUnit: (updated) => set((s) => ({
    units: s.units.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
  })),

  removeUnit: (id) => set((s) => ({
    units: s.units.filter((u) => u.id !== id),
  })),

  // ---- Groups ----
  setGroups: (groups) => {
    set({ groups });
    db.groups.bulkPut(groups).catch(() => {});
  },

  addGroup: (group) => set((s) => ({
    groups: [...s.groups.filter((g) => g.id !== group.id), group],
  })),

  updateGroup: (updated) => set((s) => ({
    groups: s.groups.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
  })),

  removeGroup: (id) => set((s) => ({
    groups: s.groups.filter((g) => g.id !== id),
  })),

  // ---- Waypoints ----
  setWaypoints: (waypoints) => set({ waypoints }),

  addWaypoint: (wp) => set((s) => ({
    waypoints: [...s.waypoints, wp],
  })),

  removeWaypoint: (id) => set((s) => ({
    waypoints: s.waypoints.filter((w) => w.id !== id),
  })),

  clearWaypoints: (unitId) => set((s) => ({
    waypoints: s.waypoints.filter((w) => w.unit_id !== unitId),
  })),

  // ---- Contacts / IFF ----
  setContacts: (contacts) => {
    set({ contacts });
    db.contacts.bulkPut(contacts).catch(() => {});
  },

  addContact: (contact) => set((s) => {
    db.contacts.put(contact).catch(() => {});
    return { contacts: [...s.contacts.filter((c) => c.id !== contact.id), contact] };
  }),

  updateContact: (updated) => set((s) => {
    db.contacts.put(updated).catch(() => {});
    return { contacts: s.contacts.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)) };
  }),

  removeContact: (id) => set((s) => {
    db.contacts.delete(id).catch(() => {});
    return { contacts: s.contacts.filter((c) => c.id !== id) };
  }),

  // ---- Tasks ----
  setTasks: (tasks) => {
    set({ tasks });
    db.tasks.bulkPut(tasks).catch(() => {});
  },

  addTask: (task) => set((s) => {
    db.tasks.put(task).catch(() => {});
    return { tasks: [...s.tasks.filter((t) => t.id !== task.id), task] };
  }),

  updateTask: (updated) => set((s) => {
    db.tasks.put(updated).catch(() => {});
    return { tasks: s.tasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) };
  }),

  removeTask: (id) => set((s) => {
    db.tasks.delete(id).catch(() => {});
    return { tasks: s.tasks.filter((t) => t.id !== id) };
  }),

  // ---- Operations ----
  setOperations: (operations) => set({ operations }),

  addOperation: (op) => set((s) => ({
    operations: [...s.operations.filter((o) => o.id !== op.id), op],
  })),

  updateOperation: (updated) => set((s) => ({
    operations: s.operations.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)),
  })),

  removeOperation: (id) => set((s) => ({
    operations: s.operations.filter((o) => o.id !== id),
  })),

  // ---- Events ----
  setEvents: (events) => set({ events }),

  addEvent: (event) => set((s) => ({
    events: [event, ...s.events].slice(0, 200),
  })),

  // ---- Messages ----
  setMessages: (messages) => set({ messages }),

  addMessage: (msg) => set((s) => ({
    messages: [msg, ...s.messages].slice(0, 200),
  })),

  // ---- Bookmarks ----
  setBookmarks: (bookmarks) => set({ bookmarks }),

  addBookmark: (bm) => set((s) => ({
    bookmarks: [...s.bookmarks, bm],
  })),

  removeBookmark: (id) => set((s) => ({
    bookmarks: s.bookmarks.filter((b) => b.id !== id),
  })),

  // ---- Navigation Data ----
  setNavData: (navData) => set({ navData }),

  // ---- Selection ----
  selectUnit: (id) => set((s) => ({
    selectedUnitIds: s.selectedUnitIds.includes(id)
      ? s.selectedUnitIds
      : [...s.selectedUnitIds, id],
  })),

  deselectUnit: (id) => set((s) => ({
    selectedUnitIds: s.selectedUnitIds.filter((uid) => uid !== id),
  })),

  toggleSelectUnit: (id) => set((s) => ({
    selectedUnitIds: s.selectedUnitIds.includes(id)
      ? s.selectedUnitIds.filter((uid) => uid !== id)
      : [...s.selectedUnitIds, id],
  })),

  clearSelection: () => set({ selectedUnitIds: [] }),

  // ---- Online users ----
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  // ---- Sync ----
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  // ---- Load from offline cache ----
  loadFromCache: async (teamId) => {
    try {
      const units = await db.units.where('team_id').equals(teamId).toArray();
      const groups = await db.groups.where('team_id').equals(teamId).toArray();
      const contacts = await db.contacts.where('team_id').equals(teamId).toArray();
      const tasks = await db.tasks.where('team_id').equals(teamId).toArray();
      if (units.length > 0) set({ units });
      if (groups.length > 0) set({ groups });
      if (contacts.length > 0) set({ contacts });
      if (tasks.length > 0) set({ tasks });
    } catch {
      // IndexedDB not available
    }
  },
}));
