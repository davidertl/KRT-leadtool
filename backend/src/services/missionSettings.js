/**
 * Helpers for mission settings defaults and access.
 */

const DEFAULT_MISSION_SETTINGS = Object.freeze({
  companion_status_sync_enabled: true,
});

function normalizeMissionSettings(settings) {
  const normalized = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? { ...settings }
    : {};

  return {
    ...DEFAULT_MISSION_SETTINGS,
    ...normalized,
    companion_status_sync_enabled: normalized.companion_status_sync_enabled !== false,
  };
}

function isCompanionStatusSyncEnabled(settings) {
  return normalizeMissionSettings(settings).companion_status_sync_enabled;
}

module.exports = {
  DEFAULT_MISSION_SETTINGS,
  normalizeMissionSettings,
  isCompanionStatusSyncEnabled,
};
