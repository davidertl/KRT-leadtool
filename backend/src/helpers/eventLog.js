/**
 * Shared helper to insert event log entries.
 */

const { query } = require('../db/postgres');
const { broadcastToMission } = require('../socket');

/**
 * Insert an event log entry and broadcast it.
 * @param {object} params
 * @param {string} params.mission_id   - UUID of the mission
 * @param {string} [params.operation_id] - UUID of the operation (optional)
 * @param {string} params.event_type   - e.g. 'task_created', 'contact_reported', 'op_phase_change'
 * @param {string} params.message      - Human-readable summary
 * @param {string} [params.user_id]    - UUID of the acting user (optional)
 * @param {object} [params.metadata]   - Additional JSON metadata (optional)
 */
async function insertEventLog({ mission_id, operation_id, event_type, message, user_id, unit_id, metadata }) {
  const result = await query(
    `INSERT INTO event_log (mission_id, operation_id, user_id, unit_id, event, title, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [mission_id, operation_id || null, user_id || null, unit_id || null, event_type, message, metadata ? JSON.stringify(metadata) : null]
  );
  const row = result.rows[0];
  broadcastToMission(mission_id, 'event:created', row);
  return row;
}

module.exports = { insertEventLog };
