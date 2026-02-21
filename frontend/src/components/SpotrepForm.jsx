import React, { useState, useMemo } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const MAP_SCALE = 1e6; // must match NavPointMarker

const IFF_OPTIONS = [
  { value: 'hostile', label: '🔴 Hostile', color: '#ef4444' },
  { value: 'neutral', label: '🟡 Neutral', color: '#f59e0b' },
  { value: 'unknown', label: '🟣 Unknown', color: '#a855f7' },
  { value: 'friendly', label: '🟢 Friendly', color: '#22c55e' },
];

const THREAT_OPTIONS = ['none', 'low', 'medium', 'high', 'critical'];

const CONFIDENCE_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed', color: '#6b7280' },
  { value: 'hearsay', label: 'Hearsay', color: '#a855f7' },
  { value: 'comms', label: 'Comms Intel', color: '#f59e0b' },
  { value: 'visual', label: 'Visual', color: '#3b82f6' },
  { value: 'confirmed', label: 'Confirmed', color: '#22c55e' },
];

const SPAWNABLE_NAV_TYPES = ['station', 'rest_stop', 'outpost', 'comm_array', 'lagrange'];

/**
 * Compute absolute map-space position from a reference object + bearing + distance.
 * Bearing is in degrees (0 = +Z / north on XZ plane, clockwise).
 * Distance is in km (displayed to user) → converted to map-space units.
 * 1 map unit = 1e6 meters = 1000 km, so distanceKm / 1000 = map units.
 */
function computeRelativePosition(ref, bearingDeg, distanceKm, elevationDeg) {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const elevRad = ((elevationDeg || 0) * Math.PI) / 180;
  const distMap = distanceKm / 1000; // km → map units (1 map unit = 1000 km)

  const horizDist = distMap * Math.cos(elevRad);
  const dx = horizDist * Math.sin(bearingRad);
  const dz = horizDist * Math.cos(bearingRad);
  const dy = distMap * Math.sin(elevRad);

  return {
    x: ref.x + dx,
    y: ref.y + dy,
    z: ref.z + dz,
  };
}

/**
 * SPOTREP contact report form — uses bearing & distance from a reference object
 * Pass `contact` prop to enter edit mode (pre-fills fields, uses PUT).
 */
export default function SpotrepForm({ missionId, onClose, contact: editContact }) {
  const { navData, units } = useMissionStore();

  const isEdit = !!editContact;

  const [iff, setIff] = useState(editContact?.iff || 'unknown');
  const [threat, setThreat] = useState(editContact?.threat || 'none');
  const [confidence, setConfidence] = useState(editContact?.confidence || 'unconfirmed');
  const [name, setName] = useState(editContact?.name || '');
  const [shipType, setShipType] = useState(editContact?.ship_type || '');
  const [count, setCount] = useState(editContact?.count || 1);
  const [notes, setNotes] = useState(editContact?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [createdContact, setCreatedContact] = useState(null); // after submit, for "Create Task" flow

  // Relative position fields
  const [refId, setRefId] = useState('');
  const [bearing, setBearing] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elevation, setElevation] = useState(0);

  // Direct position override for edit mode (keeps existing position if no ref chosen)
  const [directPos, setDirectPos] = useState(
    editContact ? { x: editContact.pos_x || 0, y: editContact.pos_y || 0, z: editContact.pos_z || 0 } : null
  );

  // Build list of reference objects: nav points + own units
  const referenceObjects = useMemo(() => {
    const refs = [];

    // Nav points (stations, rest stops, etc.)
    (navData?.points || [])
      .filter((p) => SPAWNABLE_NAV_TYPES.includes(p.nav_type) && p.active !== false)
      .forEach((p) => {
        refs.push({
          id: `nav-${p.id}`,
          label: `${p.name} (${p.nav_type.replace('_', ' ')})`,
          x: (p.pos_x || 0) / MAP_SCALE,
          y: (p.pos_y || 0) / MAP_SCALE,
          z: (p.pos_z || 0) / MAP_SCALE,
          category: 'location',
        });
      });

    // Celestial bodies
    (navData?.bodies || []).forEach((b) => {
      refs.push({
        id: `body-${b.id}`,
        label: `${b.name} (${b.body_type || 'body'})`,
        x: (b.pos_x || 0) / MAP_SCALE,
        y: (b.pos_y || 0) / MAP_SCALE,
        z: (b.pos_z || 0) / MAP_SCALE,
        category: 'body',
      });
    });

    // Own units (for "near unit X" reports)
    (units || []).forEach((u) => {
      refs.push({
        id: `unit-${u.id}`,
        label: `${u.callsign ? `[${u.callsign}] ` : ''}${u.name} (unit)`,
        x: u.pos_x || 0,
        y: u.pos_y || 0,
        z: u.pos_z || 0,
        category: 'unit',
      });
    });

    return refs.sort((a, b) => a.label.localeCompare(b.label));
  }, [navData, units]);

  const selectedRef = referenceObjects.find((r) => r.id === refId);

  // Compute preview of absolute position
  const computedPos = selectedRef
    ? computeRelativePosition(selectedRef, bearing, distanceKm, elevation)
    : null;

  // Auto-generate name: [threat] RefPoint distance
  const autoName = useMemo(() => {
    if (!selectedRef) return '';
    const refLabel = selectedRef.label.split(' (')[0];
    const dist = distanceKm > 0 ? ` ${distanceKm}km` : '';
    const typeLabel = shipType || iff;
    return `${typeLabel} ${refLabel}${dist}`.trim();
  }, [selectedRef, distanceKm, shipType, iff]);

  // Use autoName as fallback if name is empty
  const effectiveName = name.trim() || autoName;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // In edit mode, use relative position if a ref was chosen, otherwise keep direct position
    let pos;
    if (refId && selectedRef) {
      pos = computeRelativePosition(selectedRef, bearing, distanceKm, elevation);
    } else if (isEdit && directPos) {
      pos = directPos;
    } else {
      toast.error('Please select a reference location');
      return;
    }

    setSubmitting(true);

    try {
      const url = isEdit ? `/api/contacts/${editContact.id}` : '/api/contacts';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = {
        iff,
        threat,
        confidence,
        name: effectiveName || null,
        ship_type: shipType || null,
        count,
        pos_x: pos.x,
        pos_y: pos.y,
        pos_z: pos.z,
        notes: notes || null,
      };
      if (!isEdit) {
        payload.mission_id = missionId;
        payload.vel_x = 0;
        payload.vel_y = 0;
        payload.vel_z = 0;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to submit');
      const contact = await res.json();
      if (isEdit) {
        useMissionStore.getState().updateContact(contact);
        toast.success('SPOTREP updated');
        onClose();
      } else {
        setCreatedContact(contact);
        toast.success('SPOTREP filed');
      }
    } catch {
      toast.error(isEdit ? 'Failed to update SPOTREP' : 'Failed to submit SPOTREP');
    } finally {
      setSubmitting(false);
    }
  };

  // Create task from spotrep (works for both new and edit mode)
  const handleCreateTask = async (sourceContact) => {
    if (!sourceContact) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mission_id: missionId,
          title: `Respond to: ${sourceContact.name || 'Contact'}`,
          description: `Auto-created from SPOTREP. ${sourceContact.iff} ${sourceContact.ship_type || ''} ×${sourceContact.count}. Threat: ${sourceContact.threat}`,
          task_type: sourceContact.iff === 'hostile' ? 'intercept' : 'recon',
          priority: sourceContact.threat === 'critical' ? 'critical' : sourceContact.threat === 'high' ? 'high' : 'normal',
          target_x: sourceContact.pos_x,
          target_y: sourceContact.pos_y,
          target_z: sourceContact.pos_z,
          target_contact: sourceContact.id,
          source_contact_id: sourceContact.id,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Task created from SPOTREP');
      onClose();
    } catch {
      toast.error('Failed to create task');
    }
  };

  // Post-submission view
  if (createdContact) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-green-400 flex items-center gap-1.5">✅ SPOTREP Filed</h4>
        <div className="bg-krt-bg/50 rounded-lg p-3 text-sm space-y-1">
          <div className="text-white font-semibold">{createdContact.name || 'Contact'}</div>
          <div className="text-xs text-gray-400">
            {createdContact.iff} · {createdContact.threat} threat · ×{createdContact.count}
          </div>
          {createdContact.ship_type && <div className="text-xs text-gray-500">{createdContact.ship_type}</div>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleCreateTask(createdContact)} className="bg-krt-accent text-white text-sm px-3 py-1.5 rounded">
            🎯 Create Task from SPOTREP
          </button>
          <button onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
        {isEdit ? '✏️ Edit SPOTREP' : '📡 SPOTREP — Contact Report'}
      </h4>

      {/* IFF Classification */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Classification (IFF)</label>
        <div className="grid grid-cols-2 gap-1">
          {IFF_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIff(opt.value)}
              className={`text-xs px-2 py-1.5 rounded transition-colors ${
                iff === opt.value
                  ? 'text-white border-2'
                  : 'bg-krt-bg text-gray-400 border border-krt-border hover:text-white'
              }`}
              style={iff === opt.value ? { backgroundColor: opt.color + '33', borderColor: opt.color } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Threat */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Threat Level</label>
        <div className="flex gap-1">
          {THREAT_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setThreat(t)}
              className={`text-xs px-2 py-1 rounded flex-1 transition-colors ${
                threat === t
                  ? 'bg-krt-accent text-white'
                  : 'bg-krt-bg text-gray-400 border border-krt-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Confidence</label>
        <div className="flex gap-1">
          {CONFIDENCE_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setConfidence(c.value)}
              className={`text-[10px] px-1.5 py-1 rounded flex-1 transition-colors ${
                confidence === c.value
                  ? 'text-white border-2'
                  : 'bg-krt-bg text-gray-400 border border-krt-border'
              }`}
              style={confidence === c.value ? { backgroundColor: c.color + '33', borderColor: c.color } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Identification */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Name {autoName && <span className="text-gray-600">(auto: {autoName})</span>}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={autoName || 'Unknown'}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Ship Type</label>
          <input
            type="text"
            value={shipType}
            onChange={(e) => setShipType(e.target.value)}
            placeholder="Unknown"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>

      {/* Count */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Count</label>
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          min={1}
          className="w-20 bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
        />
      </div>

      {/* Relative Position — reference object + bearing + distance */}
      <div className="space-y-2 p-2 bg-krt-bg/50 rounded-lg border border-krt-border">
        <label className="text-xs text-gray-400 block font-semibold">📍 Position (relative to reference)</label>

        {/* Reference object selector */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Reference *</label>
          <select
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">Select reference…</option>
            {referenceObjects.filter((r) => r.category === 'location').length > 0 && (
              <optgroup label="Locations">
                {referenceObjects.filter((r) => r.category === 'location').map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </optgroup>
            )}
            {referenceObjects.filter((r) => r.category === 'body').length > 0 && (
              <optgroup label="Celestial Bodies">
                {referenceObjects.filter((r) => r.category === 'body').map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </optgroup>
            )}
            {referenceObjects.filter((r) => r.category === 'unit').length > 0 && (
              <optgroup label="Own Units">
                {referenceObjects.filter((r) => r.category === 'unit').map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Bearing + Distance + Elevation */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bearing (°)</label>
            <input
              type="number"
              value={bearing}
              onChange={(e) => setBearing(parseFloat(e.target.value) || 0)}
              min={0}
              max={360}
              step={1}
              placeholder="0–360"
              className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Distance (km)</label>
            <input
              type="number"
              value={distanceKm}
              onChange={(e) => setDistanceKm(Math.max(0, parseFloat(e.target.value) || 0))}
              min={0}
              step={1}
              placeholder="km"
              className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Elev. (°)</label>
            <input
              type="number"
              value={elevation}
              onChange={(e) => setElevation(parseFloat(e.target.value) || 0)}
              min={-90}
              max={90}
              step={1}
              placeholder="±90"
              className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
            />
          </div>
        </div>

        {/* Position preview */}
        {selectedRef && (
          <div className="text-[10px] text-gray-500 mt-1">
            {distanceKm > 0
              ? `${distanceKm} km, ${bearing}° from ${selectedRef.label.split(' (')[0]}`
              : `At ${selectedRef.label.split(' (')[0]}`}
            {computedPos && (
              <span className="text-gray-600 ml-1">
                → ({computedPos.x.toFixed(1)}, {computedPos.y.toFixed(1)}, {computedPos.z.toFixed(1)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Activity, weapons, heading, behavior…"
          className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-krt-accent text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
        >
          {submitting ? (isEdit ? 'Saving…' : 'Filing…') : (isEdit ? 'Save Changes' : 'File SPOTREP')}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={() => handleCreateTask(editContact)}
            className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-3 py-1.5 rounded"
          >
            🎯 Create Task
          </button>
        )}
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}
