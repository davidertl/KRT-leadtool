import React, { useState, useEffect } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { useVehicleData } from '../hooks/useVehicleData';
import { STATUS_OPTIONS, STATUS_COLORS, ROE_LABELS } from '../lib/constants';
import toast from 'react-hot-toast';

function ResourceBar({ label, value, color, warning = 25 }) {
  const pct = Math.max(0, Math.min(100, value ?? 100));
  const isLow = pct <= warning;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-10">{label}</span>
      <div className="flex-1 h-2 bg-krt-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: isLow ? '#ef4444' : color }}
        />
      </div>
      <span className={`text-[10px] font-mono ${isLow ? 'text-red-400' : 'text-gray-400'}`}>{pct}%</span>
    </div>
  );
}

/**
 * Detailed panel for a single selected unit — shows info, position, history, and edit controls
 */
export default function UnitDetailPanel({ unitId, onClose }) {
  const { units, groups, waypoints, tasks, contacts, focusUnit } = useMissionStore();
  const unit = units.find((u) => u.id === unitId);
  const group = unit ? groups.find((g) => g.id === unit.group_id) : null;
  const unitWaypoints = unit ? waypoints.filter((w) => w.unit_id === unit.id).sort((a, b) => a.sequence - b.sequence) : [];
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCallsign, setEditCallsign] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editRoe, setEditRoe] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editFuel, setEditFuel] = useState(100);
  const [editAmmo, setEditAmmo] = useState(100);
  const [editHull, setEditHull] = useState(100);
  const [editCrewCount, setEditCrewCount] = useState(1);
  const [editCrewMax, setEditCrewMax] = useState('');
  const { imageUrl, thumbnailUrl, loading: imgLoading, license, vehicleData } = useVehicleData(unit?.ship_type);

  // Permission check
  const canEditUnit = useMissionStore.getState().canEdit(unit?.group_id);

  // For person-to-ship transfers
  const parentShip = unit?.parent_unit_id ? units.find((u) => u.id === unit.parent_unit_id) : null;
  const ships = units.filter((u) => (u.unit_type === 'ship' || u.unit_type === 'ground_vehicle') && u.mission_id === unit?.mission_id);
  const personsAboard = unit ? units.filter((u) => u.parent_unit_id === unit.id) : [];

  useEffect(() => {
    if (!unit) return;
    setEditName(unit.name);
    setEditNotes(unit.notes || '');
    setEditCallsign(unit.callsign || '');
    setEditRole(unit.role || '');
    setEditRoe(unit.roe || 'self_defence');
    setEditGroupId(unit.group_id || '');
    setEditFuel(unit.fuel ?? 100);
    setEditAmmo(unit.ammo ?? 100);
    setEditHull(unit.hull ?? 100);
    setEditCrewCount(unit.crew_count ?? 1);
    setEditCrewMax(unit.crew_max ?? '');

    // Fetch history
    fetch(`/api/history/${unit.id}?limit=10`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [unitId, unit?.name, unit?.notes]);

  if (!unit) {
    return (
      <div className="p-4 text-gray-500 text-sm">Unit not found</div>
    );
  }

  const isPerson = unit.unit_type === 'person';

  const { updateUnit: storeUpdateUnit, removeUnit: storeRemoveUnit } = useMissionStore();

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`/api/units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      storeUpdateUnit(updated);
      toast.success(`Status → ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const payload = {
        name: editName,
        notes: editNotes || null,
        callsign: editCallsign || null,
        role: editRole || null,
        roe: editRoe || 'self_defence',
        group_id: editGroupId || null,
      };
      // Ship/vehicle-only fields
      if (!isPerson) {
        payload.fuel = Number(editFuel);
        payload.ammo = Number(editAmmo);
        payload.hull = Number(editHull);
        payload.crew_count = Number(editCrewCount) || 1;
        payload.crew_max = editCrewMax ? Number(editCrewMax) : null;
      }
      const res = await fetch(`/api/units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      storeUpdateUnit(updated);
      setEditing(false);
      toast.success('Unit updated');
    } catch {
      toast.error('Failed to update unit');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${unit.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/units/${unit.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      storeRemoveUnit(unit.id);
      toast.success('Unit deleted');
      onClose();
    } catch {
      toast.error('Failed to delete unit');
    }
  };

  const handleUndo = async () => {
    try {
      const res = await fetch(`/api/history/${unit.id}/undo`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Nothing to undo');
      const data = await res.json();
      toast.success(data.message);
      // Re-fetch history
      const histRes = await fetch(`/api/history/${unit.id}?limit=10`, { credentials: 'include' });
      const newHist = await histRes.json();
      setHistory(Array.isArray(newHist) ? newHist : []);
    } catch {
      toast.error('Nothing to undo');
    }
  };

  const handleTransferPerson = async (personId, newParentId) => {
    try {
      const res = await fetch(`/api/units/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parent_unit_id: newParentId || null }),
      });
      if (!res.ok) throw new Error('Failed to transfer');
      const updated = await res.json();
      storeUpdateUnit(updated);
      toast.success(newParentId ? 'Person transferred' : 'Person disembarked');
    } catch {
      toast.error('Failed to transfer person');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {editing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
            />
          ) : (
            <h3 className="font-bold text-white">{unit.name}</h3>
          )}
          <div className="text-xs text-gray-400 mt-0.5">
            {isPerson ? (unit.role || 'Person') : (unit.ship_type || 'Unknown ship')}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => focusUnit(unit.id)}
            className="text-xs text-krt-accent hover:text-blue-400 px-1.5 py-0.5"
            title="Focus on map"
          >
            🎯
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm px-1">✕</button>
        </div>
      </div>

      {/* Ship Image (vehicles only) */}
      {!isPerson && (imageUrl || imgLoading) && (
        <div className="relative rounded-lg overflow-hidden bg-krt-bg">
          {imgLoading ? (
            <div className="h-24 flex items-center justify-center text-gray-500 text-xs">Loading image…</div>
          ) : (
            <>
              <img
                src={thumbnailUrl || imageUrl}
                alt={unit.ship_type}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
              {license && (
                <div className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-gray-400 px-1.5 py-0.5 rounded-tl">
                  {license.author && <span>{license.author}</span>}
                  {license.type && (
                    <> · <a href={license.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline">{license.type}</a></>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Vehicle Specs (vehicles only) */}
      {!isPerson && vehicleData && (
        <div className="bg-krt-bg rounded-lg p-2.5">
          <label className="text-[10px] text-gray-500 block mb-1.5">Vehicle Specs</label>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
            {vehicleData.displayName && (
              <div className="col-span-2">
                <span className="text-gray-500">Name </span>
                <span className="text-gray-200">{vehicleData.displayName}</span>
              </div>
            )}
            {vehicleData.sizeCategory && (
              <div>
                <span className="text-gray-500">Size </span>
                <span className="text-gray-200 capitalize">{vehicleData.sizeCategory}</span>
              </div>
            )}
            {vehicleData.crewMax != null && (
              <div>
                <span className="text-gray-500">Max Crew </span>
                <span className="text-gray-200">{vehicleData.crewMax}</span>
              </div>
            )}
            {vehicleData.fuelCapacity != null && (
              <div>
                <span className="text-gray-500">Fuel </span>
                <span className="text-gray-200">{vehicleData.fuelCapacity}</span>
              </div>
            )}
            {vehicleData.cargoCapacity != null && (
              <div>
                <span className="text-gray-500">Cargo </span>
                <span className="text-gray-200">{vehicleData.cargoCapacity} SCU</span>
              </div>
            )}
            {vehicleData.hullHp != null && (
              <div>
                <span className="text-gray-500">Hull HP </span>
                <span className="text-gray-200">{vehicleData.hullHp.toLocaleString()}</span>
              </div>
            )}
            {vehicleData.manufacturer && (
              <div className="col-span-3">
                <span className="text-gray-500">Mfr </span>
                <span className="text-gray-200">{vehicleData.manufacturer}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Callsign, Discord ID, Role, Unit Type */}
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 block">Callsign</label>
              <input type="text" value={editCallsign} onChange={(e) => setEditCallsign(e.target.value)}
                className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" placeholder="Callsign" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 block">Role</label>
              <input type="text" value={editRole} onChange={(e) => setEditRole(e.target.value)}
                className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" placeholder="Role" />
            </div>
          </div>
          {!isPerson && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-600 block">Crew Count</label>
              <input type="number" min={0} value={editCrewCount} onChange={(e) => setEditCrewCount(e.target.value)}
                className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 block">Crew Max</label>
              <input type="number" min={0} value={editCrewMax} onChange={(e) => setEditCrewMax(e.target.value)}
                className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" />
            </div>
          </div>
          )}
          <div>
            <label className="text-[10px] text-gray-600 block">Group</label>
            <select value={editGroupId} onChange={(e) => setEditGroupId(e.target.value)}
              className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent">
              <option value="">— No Group —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-600 block">ROE</label>
            <div className="flex flex-wrap gap-1">
              {Object.entries(ROE_LABELS).map(([key, { label, color }]) => (
                <button key={key} type="button" onClick={() => setEditRoe(key)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors border ${editRoe === key ? 'border-white' : 'border-krt-border'}`}
                  style={{ backgroundColor: editRoe === key ? color + '30' : 'transparent', color }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-600 block mb-1">Resources</label>
            <div className="space-y-1">
              {[['Fuel', editFuel, setEditFuel, '#3b82f6'], ['Ammo', editAmmo, setEditAmmo, '#f59e0b'], ['Hull', editHull, setEditHull, '#22c55e']].map(([lbl, val, setter, col]) => (
                <div key={lbl} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-10">{lbl}</span>
                  <input type="range" min={0} max={100} value={val} onChange={(e) => setter(Number(e.target.value))}
                    className="flex-1 h-2 accent-krt-accent" style={{ accentColor: col }} />
                  <span className="text-[10px] text-gray-400 w-8 text-right font-mono">{val}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
        {unit.callsign && (
          <div>
            <label className="text-[10px] text-gray-600">Callsign</label>
            <div className="text-sm text-krt-accent font-mono font-bold">{unit.callsign}</div>
          </div>
        )}
        {unit.vhf_frequency != null && (
          <div>
            <label className="text-[10px] text-gray-600">Comm Channel</label>
            <div className="text-sm text-krt-accent font-mono font-bold">{unit.vhf_frequency}</div>
          </div>
        )}
        {unit.discord_id && (
          <div>
            <label className="text-[10px] text-gray-600">Discord ID</label>
            <div className="text-sm text-gray-300 font-mono">{unit.discord_id}</div>
          </div>
        )}
        {unit.role && (
          <div>
            <label className="text-[10px] text-gray-600">Role</label>
            <div className="text-sm text-gray-300">{unit.role}</div>
          </div>
        )}
        {unit.unit_type && unit.unit_type !== 'ship' && (
          <div>
            <label className="text-[10px] text-gray-600">Type</label>
            <div className="text-sm text-gray-300">{unit.unit_type.replace('_', ' ')}</div>
          </div>
        )}
        {(unit.crew_count != null || unit.crew_max != null) && (
          <div>
            <label className="text-[10px] text-gray-600">Crew</label>
            <div className="text-sm text-gray-300">{unit.crew_count ?? 1}{unit.crew_max ? `/${unit.crew_max}` : ''}</div>
          </div>
        )}
      </div>
      )}

      {/* Resources (read-only when not editing) */}
      {!editing && (
      <div>
        <label className="text-xs text-gray-500 block mb-1">Resources</label>
        <div className="space-y-1.5">
          <ResourceBar label="FUEL" value={unit.fuel} color="#3b82f6" />
          <ResourceBar label="AMMO" value={unit.ammo} color="#f59e0b" />
          <ResourceBar label="HULL" value={unit.hull} color="#22c55e" />
        </div>
      </div>
      )}

      {/* ROE (read-only when not editing) */}
      {!editing && unit.roe && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">ROE</label>
          <span
            className="text-xs font-bold px-2 py-1 rounded"
            style={{ backgroundColor: (ROE_LABELS[unit.roe]?.color || '#6b7280') + '20', color: ROE_LABELS[unit.roe]?.color || '#6b7280' }}
          >
            {ROE_LABELS[unit.roe]?.label || unit.roe}
          </span>
        </div>
      )}

      {/* Status */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Status</label>
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => canEditUnit && handleStatusChange(s)}
              disabled={!canEditUnit}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                unit.status === s
                  ? 'text-white'
                  : 'bg-krt-bg border border-krt-border text-gray-400 hover:text-white hover:border-krt-accent'
              } ${!canEditUnit ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={unit.status === s ? { backgroundColor: STATUS_COLORS[s] } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Group */}
      {/* Group (read-only; editable in edit mode above) */}
      {!editing && group && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Group</label>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <span className="text-sm text-white">{group.name}</span>
            <span className="text-xs text-gray-500">{group.class_type}</span>
          </div>
        </div>
      )}

      {/* Aboard (for persons — show which ship they're on and allow transfer) */}
      {unit.unit_type === 'person' && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Aboard</label>
          <select
            value={unit.parent_unit_id || ''}
            onChange={(e) => handleTransferPerson(unit.id, e.target.value || null)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— Not aboard any ship —</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>{s.callsign ? `[${s.callsign}] ` : ''}{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Persons aboard (for ships/vehicles — list persons assigned to this unit) */}
      {(unit.unit_type === 'ship' || unit.unit_type === 'ground_vehicle') && personsAboard.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Persons Aboard ({personsAboard.length})
          </label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {personsAboard.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-krt-bg rounded px-2 py-1.5">
                <span className="text-sm text-white truncate">{p.name}</span>
                <button
                  onClick={() => handleTransferPerson(p.id, null)}
                  className="text-xs text-red-400 hover:text-red-300 ml-2 whitespace-nowrap"
                  title="Remove from ship"
                >
                  ✕ Disembark
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Position</label>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-krt-bg rounded px-2 py-1">
            <span className="text-gray-500">X:</span> <span className="text-white">{unit.pos_x?.toFixed(1)}</span>
          </div>
          <div className="bg-krt-bg rounded px-2 py-1">
            <span className="text-gray-500">Y:</span> <span className="text-white">{unit.pos_y?.toFixed(1)}</span>
          </div>
          <div className="bg-krt-bg rounded px-2 py-1">
            <span className="text-gray-500">Z:</span> <span className="text-white">{unit.pos_z?.toFixed(1)}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Heading: {unit.heading?.toFixed(1)}°
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes</label>
        {editing ? (
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent resize-none"
            placeholder="Add notes…"
          />
        ) : (
          <p className="text-sm text-gray-300 bg-krt-bg rounded p-2 min-h-[2.5rem]">
            {unit.notes || <span className="text-gray-600 italic">No notes</span>}
          </p>
        )}
      </div>

      {/* Assigned Tasks */}
      {(() => {
        const unitTasks = tasks.filter((t) => t.assigned_to === unit.id && t.status !== 'completed' && t.status !== 'cancelled');
        return unitTasks.length > 0 ? (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Assigned Tasks ({unitTasks.length})</label>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {unitTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs bg-krt-bg rounded px-2 py-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.priority === 'critical' ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                  <span className="text-white truncate flex-1">{t.title}</span>
                  <span className="text-gray-500 capitalize">{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Related Contacts (reported by this unit's owner or linked) */}
      {(() => {
        const unitContacts = contacts.filter((c) => c.is_active);
        // Show up to 5 most recent active contacts for reference
        return unitContacts.length > 0 ? (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Active Contacts ({unitContacts.length})</label>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {unitContacts.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs bg-krt-bg rounded px-2 py-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.iff === 'hostile' ? 'bg-red-500' : c.iff === 'friendly' ? 'bg-green-500' : c.iff === 'neutral' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                  <span className="text-white truncate flex-1">{c.name || c.ship_type || 'Contact'} ×{c.count}</span>
                  <span className="text-gray-500 capitalize">{c.threat}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Waypoints */}
      {unitWaypoints.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Waypoints ({unitWaypoints.length})
          </label>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {unitWaypoints.map((wp, i) => (
              <div key={wp.id} className="text-xs bg-krt-bg rounded px-2 py-1 flex justify-between">
                <span className="text-gray-400">#{i + 1} {wp.label || ''}</span>
                <span className="text-gray-500">
                  ({wp.pos_x?.toFixed(0)}, {wp.pos_y?.toFixed(0)}, {wp.pos_z?.toFixed(0)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Recent Changes</label>
            <button
              onClick={handleUndo}
              className="text-xs text-krt-accent hover:text-blue-400"
            >
              ↩ Undo last
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {history.map((h) => {
              let oldVal, newVal;
              try { oldVal = JSON.parse(h.old_value || 'null'); } catch { oldVal = h.old_value; }
              try { newVal = JSON.parse(h.new_value || 'null'); } catch { newVal = h.new_value; }
              return (
                <div key={h.id} className="text-xs bg-krt-bg rounded px-2 py-1">
                  <span className="text-gray-400">{h.field_changed}:</span>{' '}
                  <span className="text-red-400 line-through">{String(oldVal ?? '')}</span>{' '}
                  <span className="text-green-400">→ {String(newVal ?? '')}</span>
                  <span className="text-gray-600 ml-2">
                    {h.changed_by_name && `by ${h.changed_by_name}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {canEditUnit && (
        <div className="flex gap-2 pt-2 border-t border-krt-border">
          {editing ? (
            <>
              <button onClick={handleSaveEdit} className="bg-krt-accent text-white text-xs px-3 py-1 rounded">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-gray-400 text-xs px-3 py-1">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-krt-accent text-xs px-3 py-1 hover:text-blue-400">
                Edit
              </button>
              <button onClick={handleDelete} className="text-red-400 text-xs px-3 py-1 hover:text-red-300 ml-auto">
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
