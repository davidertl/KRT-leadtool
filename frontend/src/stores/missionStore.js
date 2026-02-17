/**
 * Mission/Map state store (Zustand)
 * Manages units, groups, waypoints for the active team
 */
import { create } from 'zustand';
import { db } from '../lib/offlineDb';

export const useMissionStore = create((set, get) => ({
  teamId: null,
  units: [],
  groups: [],
  waypoints: [],
  onlineUsers: [],
  selectedUnitIds: [],
  lastSyncTime: null,

  setTeamId: (teamId) => set({ teamId }),

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
      if (units.length > 0) set({ units });
      if (groups.length > 0) set({ groups });
    } catch {
      // IndexedDB not available
    }
  },
}));
