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

/**
 * Save the last sync timestamp for a team
 */
export async function setLastSync(teamId, timestamp) {
  await db.syncMeta.put({ key: `lastSync:${teamId}`, value: timestamp });
}

/**
 * Get the last sync timestamp for a team
 */
export async function getLastSync(teamId) {
  const record = await db.syncMeta.get(`lastSync:${teamId}`);
  return record?.value || null;
}
