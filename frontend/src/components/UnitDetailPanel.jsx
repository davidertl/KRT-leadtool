import React, { useState, useEffect } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { useShipImage } from '../hooks/useShipImage';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['idle', 'en_route', 'on_station', 'engaged', 'rtb', 'disabled'];

const STATUS_COLORS = {
  idle: 'bg-gray-500',
  en_route: 'bg-blue-500',
  on_station: 'bg-green-500',
  engaged: 'bg-red-500',
  rtb: 'bg-yellow-500',
  disabled: 'bg-gray-700',
};

const ROE_LABELS = {
  weapons_free: { label: 'WEAPONS FREE', color: '#ef4444' },
  weapons_tight: { label: 'WEAPONS TIGHT', color: '#f59e0b' },
  weapons_hold: { label: 'WEAPONS HOLD', color: '#22c55e' },
  defensive: { label: 'DEFENSIVE', color: '#3b82f6' },
  aggressive: { label: 'AGGRESSIVE', color: '#dc2626' },
  no_fire: { label: 'NO FIRE', color: '#9ca3af' },
};

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
  const { units, groups, waypoints, focusUnit } = useMissionStore();
  const unit = units.find((u) => u.id === unitId);
  const group = unit ? groups.find((g) => g.id === unit.group_id) : null;
  const unitWaypoints = unit ? waypoints.filter((w) => w.unit_id === unit.id).sort((a, b) => a.sequence - b.sequence) : [];
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const { imageUrl, thumbnailUrl, loading: imgLoading, license } = useShipImage(unit?.ship_type);

  useEffect(() => {
    if (!unit) return;
    setEditName(unit.name);
    setEditNotes(unit.notes || '');

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
      const res = await fetch(`/api/units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName, notes: editNotes || null }),
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
            {unit.ship_type || 'Unknown ship'}
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

      {/* Ship Image */}
      {(imageUrl || imgLoading) && (
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

      {/* Callsign, Role, Unit Type */}
      <div className="grid grid-cols-2 gap-2">
        {unit.callsign && (
          <div>
            <label className="text-[10px] text-gray-600">Callsign</label>
            <div className="text-sm text-krt-accent font-mono font-bold">{unit.callsign}</div>
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

      {/* Resources */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Resources</label>
        <div className="space-y-1.5">
          <ResourceBar label="FUEL" value={unit.fuel} color="#3b82f6" />
          <ResourceBar label="AMMO" value={unit.ammo} color="#f59e0b" />
          <ResourceBar label="HULL" value={unit.hull} color="#22c55e" />
        </div>
      </div>

      {/* ROE */}
      {unit.roe && (
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
              onClick={() => handleStatusChange(s)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                unit.status === s
                  ? `${STATUS_COLORS[s]} text-white`
                  : 'bg-krt-bg border border-krt-border text-gray-400 hover:text-white hover:border-krt-accent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Group */}
      {group && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Group</label>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <span className="text-sm text-white">{group.name}</span>
            <span className="text-xs text-gray-500">{group.mission}</span>
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
    </div>
  );
}
