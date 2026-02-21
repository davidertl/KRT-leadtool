import React, { useState, useEffect } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { STATUS_OPTIONS, STATUS_COLORS, ROE_LABELS } from '../lib/constants';
import toast from 'react-hot-toast';

/**
 * Detail panel for a Person (unit_type === 'person').
 * Shows person-specific fields only: name, role, discord_id, parent ship, notes.
 * No fuel/ammo/hull/crew fields.
 */
export default function PersonDetailPanel({ unitId, onClose }) {
  const { units, groups, tasks, focusUnit, updateUnit: storeUpdateUnit, removeUnit: storeRemoveUnit } = useMissionStore();
  const person = units.find((u) => u.id === unitId);
  const group = person ? groups.find((g) => g.id === person.group_id) : null;
  const parentShip = person?.parent_unit_id ? units.find((u) => u.id === person.parent_unit_id) : null;
  const ships = units.filter((u) => (u.unit_type === 'ship' || u.unit_type === 'ground_vehicle') && u.mission_id === person?.mission_id);

  const canEditPerson = useMissionStore.getState().canEdit(person?.group_id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCallsign, setEditCallsign] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRoe, setEditRoe] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!person) return;
    setEditName(person.name);
    setEditRole(person.role || '');
    setEditCallsign(person.callsign || '');
    setEditNotes(person.notes || '');
    setEditRoe(person.roe || 'self_defence');
    setEditGroupId(person.group_id || '');

    fetch(`/api/history/${person.id}?limit=10`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [unitId, person?.name, person?.notes]);

  if (!person) {
    return <div className="p-4 text-gray-500 text-sm">Person not found</div>;
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`/api/units/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      storeUpdateUnit(await res.json());
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
      const res = await fetch(`/api/units/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      storeUpdateUnit(await res.json());
      setEditing(false);
      toast.success('Person updated');
    } catch {
      toast.error('Failed to update person');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${person.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/units/${person.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
      storeRemoveUnit(person.id);
      toast.success('Person deleted');
      onClose();
    } catch {
      toast.error('Failed to delete person');
    }
  };

  const handleTransfer = async (newParentId) => {
    try {
      const res = await fetch(`/api/units/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parent_unit_id: newParentId || null }),
      });
      if (!res.ok) throw new Error();
      storeUpdateUnit(await res.json());
      toast.success(newParentId ? 'Person transferred' : 'Person disembarked');
    } catch {
      toast.error('Failed to transfer person');
    }
  };

  const handleUndo = async () => {
    try {
      const res = await fetch(`/api/history/${person.id}/undo`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(data.message);
      const histRes = await fetch(`/api/history/${person.id}?limit=10`, { credentials: 'include' });
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
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="text-base">🧑</span>
              {person.name}
            </h3>
          )}
          <div className="text-xs text-gray-400 mt-0.5">
            {person.role || 'No role assigned'}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => focusUnit(person.id)} className="text-xs text-krt-accent hover:text-blue-400 px-1.5 py-0.5" title="Focus on map">🎯</button>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm px-1">✕</button>
        </div>
      </div>

      {/* Edit form / read-only details */}
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
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {person.callsign && (
            <div>
              <label className="text-[10px] text-gray-600">Callsign</label>
              <div className="text-sm text-krt-accent font-mono font-bold">{person.callsign}</div>
            </div>
          )}
          {person.discord_id && (
            <div>
              <label className="text-[10px] text-gray-600">Discord</label>
              <div className="text-sm text-gray-300 font-mono">{person.discord_id}</div>
            </div>
          )}
          {person.role && (
            <div>
              <label className="text-[10px] text-gray-600">Role</label>
              <div className="text-sm text-gray-300">{person.role}</div>
            </div>
          )}
        </div>
      )}

      {/* ROE (read-only) */}
      {!editing && person.roe && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">ROE</label>
          <span
            className="text-xs font-bold px-2 py-1 rounded"
            style={{ backgroundColor: (ROE_LABELS[person.roe]?.color || '#6b7280') + '20', color: ROE_LABELS[person.roe]?.color || '#6b7280' }}
          >
            {ROE_LABELS[person.roe]?.label || person.roe}
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
              onClick={() => canEditPerson && handleStatusChange(s)}
              disabled={!canEditPerson}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                person.status === s
                  ? 'text-white'
                  : 'bg-krt-bg border border-krt-border text-gray-400 hover:text-white hover:border-krt-accent'
              } ${!canEditPerson ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={person.status === s ? { backgroundColor: STATUS_COLORS[s] } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Group (read-only) */}
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

      {/* Aboard ship */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Aboard</label>
        <select
          value={person.parent_unit_id || ''}
          onChange={(e) => handleTransfer(e.target.value || null)}
          className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          <option value="">— Not aboard any ship —</option>
          {ships.map((s) => (
            <option key={s.id} value={s.id}>{s.callsign ? `[${s.callsign}] ` : ''}{s.name}</option>
          ))}
        </select>
        {parentShip && (
          <div className="text-xs text-gray-400 mt-1">
            Currently aboard: <span className="text-white">{parentShip.callsign ? `[${parentShip.callsign}] ` : ''}{parentShip.name}</span>
            {parentShip.ship_type && <span className="text-gray-500"> ({parentShip.ship_type})</span>}
          </div>
        )}
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
            {person.notes || <span className="text-gray-600 italic">No notes</span>}
          </p>
        )}
      </div>

      {/* Assigned Tasks */}
      {(() => {
        const personTasks = tasks.filter((t) => t.assigned_to === person.id && t.status !== 'completed' && t.status !== 'cancelled');
        return personTasks.length > 0 ? (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Assigned Tasks ({personTasks.length})</label>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {personTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs bg-krt-bg rounded px-2 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.priority === 'critical' ? '#ef4444' : t.priority === 'high' ? '#f97316' : '#3b82f6' }} />
                  <span className="text-white truncate flex-1">{t.title}</span>
                  <span className="text-gray-500 capitalize">{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Recent Changes</label>
            <button onClick={handleUndo} className="text-xs text-krt-accent hover:text-blue-400">↩ Undo last</button>
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
                  <span className="text-gray-600 ml-2">{h.changed_by_name && `by ${h.changed_by_name}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {canEditPerson && (
        <div className="flex gap-2 pt-2 border-t border-krt-border">
          {editing ? (
            <>
              <button onClick={handleSaveEdit} className="bg-krt-accent text-white text-xs px-3 py-1 rounded">Save</button>
              <button onClick={() => setEditing(false)} className="text-gray-400 text-xs px-3 py-1">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-krt-accent text-xs px-3 py-1 hover:text-blue-400">Edit</button>
              <button onClick={handleDelete} className="text-red-400 text-xs px-3 py-1 hover:text-red-300 ml-auto">Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
