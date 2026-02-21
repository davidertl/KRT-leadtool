/**
 * Offline database using Dexie (IndexedDB wrapper)
 * Apache 2.0 licensed - for offline/reconnect caching
 */
import Dexie from 'dexie';

export const db = new Dexie('KRTLeadtool');

db.version(1).stores({
  units: 'id, team_id, group_id, owner_id, status, updated_at',
  groups: 'id, team_id, mission',
  waypoints: 'id, unit_id, sequence',
  syncMeta: 'key',
});

db.version(2).stores({
  units: 'id, team_id, group_id, owner_id, status, updated_at',
  groups: 'id, team_id, mission',
  waypoints: 'id, unit_id, sequence',
  contacts: 'id, team_id, iff, is_active, updated_at',
  tasks: 'id, team_id, status, priority, updated_at',
  syncMeta: 'key',
});

db.version(3).stores({
  units: 'id, mission_id, group_id, owner_id, status, updated_at',
  groups: 'id, mission_id, class_type',
  waypoints: 'id, unit_id, sequence',
  contacts: 'id, mission_id, iff, is_active, updated_at',
  tasks: 'id, mission_id, status, priority, updated_at',
  syncMeta: 'key',
});

/**
 * Save the last sync timestamp for a mission
 */
export async function setLastSync(missionId, timestamp) {
  await db.syncMeta.put({ key: `lastSync:${missionId}`, value: timestamp });
}

/**
 * Get the last sync timestamp for a mission
 */
export async function getLastSync(missionId) {
  const record = await db.syncMeta.get(`lastSync:${missionId}`);
  return record?.value || null;
}
