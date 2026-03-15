/**
 * Shared status update workflow used by web and companion clients.
 */

const { query } = require('../db/postgres');
const { getUnitAccessContext, canEditUnit } = require('../auth/teamAuth');
const { broadcastToMission } = require('../socket');
const { insertEventLog } = require('../helpers/eventLog');

const STATUS_MESSAGE_TYPES = new Set([
  'boarding',
  'ready_for_takeoff',
  'on_the_way',
  'arrived',
  'ready_for_orders',
  'in_combat',
  'heading_home',
  'damaged',
  'disabled',
]);

async function updateStatusHistory({ unitId, oldValue, newValue, changedBy }) {
  await query(
    `INSERT INTO status_history (unit_id, field_changed, old_value, new_value, changed_by)
     VALUES ($1, 'status', $2, $3, $4)`,
    [unitId, JSON.stringify(oldValue), JSON.stringify(newValue), changedBy]
  ).catch(() => {});
}

async function cascadeShipStatus({ missionId, unit, messageType, updatedUnits }) {
  if (unit.unit_type !== 'person' || !unit.parent_unit_id) return;

  const personsRes = await query(
    `SELECT id, status FROM units WHERE parent_unit_id = $1 AND unit_type = 'person'`,
    [unit.parent_unit_id]
  );

  const persons = personsRes.rows;
  if (persons.length === 0 || !persons.every((person) => person.status === messageType)) {
    return;
  }

  const shipRes = await query(
    `UPDATE units SET status = $1 WHERE id = $2 AND status != $1 RETURNING *`,
    [messageType, unit.parent_unit_id]
  );

  if (shipRes.rows[0]) {
    updatedUnits.push(shipRes.rows[0]);
    broadcastToMission(missionId, 'unit:updated', shipRes.rows[0]);
  }
}

async function applyStatusMessage({
  actor,
  missionId,
  unitId,
  messageType,
  message,
  recipientType,
  recipientId,
  source = 'web',
  permissionContext,
}) {
  const isStatusMessage = STATUS_MESSAGE_TYPES.has(messageType);
  const updatedUnits = [];

  if (isStatusMessage && unitId) {
    const unitAccess = await getUnitAccessContext(unitId);
    if (!unitAccess || unitAccess.mission_id !== missionId) {
      const error = new Error('Selected unit does not belong to this mission');
      error.status = 400;
      throw error;
    }

    const canEdit = permissionContext?.canEditUnit
      ? await permissionContext.canEditUnit(unitAccess)
      : await canEditUnit(permissionContext?.req || { ...permissionContext, missionId, user: actor }, unitAccess);

    if (!canEdit) {
      const error = new Error('Insufficient permissions to update this unit status');
      error.status = 403;
      throw error;
    }

    const previousUnit = await query(
      `SELECT id, status, unit_type, parent_unit_id
       FROM units
       WHERE id = $1`,
      [unitId]
    );

    const oldStatus = previousUnit.rows[0]?.status ?? null;
    const unitRes = await query(
      `UPDATE units SET status = $1 WHERE id = $2 RETURNING *`,
      [messageType, unitId]
    );

    if (unitRes.rows[0]) {
      const updatedUnit = unitRes.rows[0];
      updatedUnits.push(updatedUnit);
      broadcastToMission(missionId, 'unit:updated', updatedUnit);
      await updateStatusHistory({
        unitId,
        oldValue: oldStatus,
        newValue: messageType,
        changedBy: actor.id,
      });
      await cascadeShipStatus({
        missionId,
        unit: updatedUnit,
        messageType,
        updatedUnits,
      });
    }
  }

  const insertedMessage = await query(
    `INSERT INTO quick_messages (mission_id, user_id, unit_id, message_type, message, recipient_type, recipient_id, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      missionId,
      actor.id,
      unitId || null,
      messageType,
      message || null,
      recipientType || null,
      recipientId || null,
      source,
    ]
  );

  const unitInfo = unitId
    ? (await query('SELECT name, callsign FROM units WHERE id = $1', [unitId])).rows[0]
    : null;
  const unitLabel = unitInfo ? (unitInfo.callsign || unitInfo.name) : 'Unknown';
  const eventTitle = isStatusMessage
    ? `${unitLabel} status -> ${messageType}`
    : `${messageType.toUpperCase()}: ${message || messageType}`;

  await insertEventLog({
    mission_id: missionId,
    user_id: actor.id,
    unit_id: unitId || null,
    event_type: isStatusMessage ? 'status_change' : 'custom',
    message: eventTitle,
    details: message || null,
    metadata: source === 'web' ? undefined : { source },
  });

  const response = {
    ...insertedMessage.rows[0],
    user_name: actor.username,
    unit_name: unitInfo?.name || null,
  };

  broadcastToMission(missionId, 'message:created', response);

  if (updatedUnits.length > 0) {
    response.updated_units = updatedUnits;
  }

  return response;
}

module.exports = {
  STATUS_MESSAGE_TYPES,
  applyStatusMessage,
};
