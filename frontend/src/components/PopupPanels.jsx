import React, { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { usePopupStore } from '../stores/popupStore';
import PopupWindow from './PopupWindow';
import SearchFilter from './SearchFilter';
import UnitDetailPanel from './UnitDetailPanel';
import PersonDetailPanel from './PersonDetailPanel';
import SpotrepForm from './SpotrepForm';
import TaskForm from './TaskForm';
import OperationPanel from './OperationPanel';
import EventLog from './EventLog';
import QuickMessages from './QuickMessages';
import BookmarkPanel from './BookmarkPanel';
import MultiplayerPanel from './MultiplayerPanel';
import toast from 'react-hot-toast';
import { CLASS_TYPES, STATUS_OPTIONS, STATUS_COLORS, IFF_COLORS, PRIORITY_COLORS, PRIORITY_BADGE_COLORS, TASK_STATUS_OPTIONS } from '../lib/constants';

/**
 * All popup windows for the map view.
 * Each wraps the corresponding panel inside a PopupWindow.
 */
export default function PopupPanels() {
  const { missionId } = useMissionStore();

  return (
    <>
      <UnitsPopup missionId={missionId} />
      <PersonsPopup missionId={missionId} />
      <GroupsPopup missionId={missionId} />
      <ContactsPopup missionId={missionId} />
      <TasksPopup missionId={missionId} />
      <SelectedPopup missionId={missionId} />
      <OpsPopup missionId={missionId} />
      <CommsPopup missionId={missionId} />
      <LogPopup missionId={missionId} />
      <BookmarksPopup missionId={missionId} />
      <MultiplayerPopup missionId={missionId} />
      <UnitDetailPopup />
      <PersonDetailPopup />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared sub-components
   ═══════════════════════════════════════════════════════════ */

/* ─── StatusBadge ──────────────────── */
function StatusBadge({ status }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: STATUS_COLORS[status] || '#6b7280' }}>
      {status}
    </span>
  );
}

/* ─── UnitListItem ─────────────────── */
function UnitListItem({ unit, group, isSelected }) {
  const { toggleSelectUnit, focusUnit } = useMissionStore();
  const { openUnitDetail, openPersonDetail } = usePopupStore();

  const handleDoubleClick = () => {
    if (unit.unit_type === 'person') {
      openPersonDetail(unit.id);
    } else {
      openUnitDetail(unit.id);
    }
  };

  return (
    <div
      onClick={() => toggleSelectUnit(unit.id)}
      onDoubleClick={handleDoubleClick}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-krt-accent/10 border border-krt-accent/30'
          : 'bg-krt-bg/50 border border-transparent hover:border-krt-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{unit.callsign ? `[${unit.callsign}] ` : ''}{unit.name}</span>
        <div className="flex items-center gap-1">
          {unit.fuel != null && unit.fuel <= 25 && <span className="text-[10px]" title={`Fuel: ${unit.fuel}%`}>⛽</span>}
          {unit.ammo != null && unit.ammo <= 25 && <span className="text-[10px]" title={`Ammo: ${unit.ammo}%`}>💨</span>}
          {unit.hull != null && unit.hull <= 25 && <span className="text-[10px]" title={`Hull: ${unit.hull}%`}>🔧</span>}
          <button
            onClick={(e) => { e.stopPropagation(); focusUnit(unit.id); }}
            className="text-gray-500 hover:text-krt-accent text-xs"
            title="Focus on map"
          >🎯</button>
          <StatusBadge status={unit.status} />
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {unit.ship_type || 'Unknown ship'} {group && `• ${group.name}`}
        {unit.role && <span className="ml-1 text-gray-600">({unit.role})</span>}
      </div>
    </div>
  );
}

/* ─── GroupListItem ────────────────── */
function GroupListItem({ group, vehicleCount, personCount, canEdit }) {
  const { units } = useMissionStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editClassType, setEditClassType] = useState(group.class_type);
  const [editVhf, setEditVhf] = useState(group.vhf_channel || '');
  const [editRoe, setEditRoe] = useState(group.roe || 'self_defence');
  const [saving, setSaving] = useState(false);

  // Units available for assignment
  const groupUnits = units.filter((u) => u.group_id === group.id);
  const unassignedUnits = units.filter((u) => !u.group_id);

  const classType = CLASS_TYPES.find((m) => m.value === group.class_type);

  const ROE_OPTS = [
    { value: 'aggressive', label: 'AGGRESSIVE' },
    { value: 'fire_at_will', label: 'FIRE AT WILL' },
    { value: 'fire_at_id_target', label: 'FIRE AT ID TARGET' },
    { value: 'self_defence', label: 'SELF DEFENCE' },
    { value: 'dnf', label: 'DO NOT FIRE' },
  ];

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const mType = CLASS_TYPES.find((m) => m.value === editClassType);
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          class_type: editClassType,
          color: mType?.color || group.color,
          vhf_channel: editVhf.trim() || null,
          roe: editRoe,
        }),
      });
      if (res.ok) { toast.success('Group updated'); setEditing(false); }
      else toast.error('Failed to update group');
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete group "${group.name}"? Units will be ungrouped.`)) return;
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) toast.success('Group deleted');
      else toast.error('Failed to delete group');
    } catch { toast.error('Network error'); }
  };

  const assignUnit = async (unitId) => {
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ group_id: group.id }),
      });
      if (res.ok) toast.success('Unit assigned');
      else toast.error('Failed to assign unit');
    } catch { toast.error('Network error'); }
  };

  const removeUnit = async (unitId) => {
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ group_id: null }),
      });
      if (res.ok) toast.success('Unit removed from group');
      else toast.error('Failed');
    } catch { toast.error('Network error'); }
  };

  if (editing) {
    return (
      <div className="p-3 rounded-lg bg-krt-bg/80 border border-krt-accent/40 space-y-2">
        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" autoFocus />
        <select value={editClassType} onChange={(e) => setEditClassType(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
          {CLASS_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* VHF Channel */}
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">VHF Channel (MHz)</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={editVhf}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '');
                // Allow at most one dot and max 2 decimal digits
                const parts = v.split('.');
                if (parts.length > 2) return;
                if (parts[0] && parts[0].length > 3) return;
                if (parts[1] && parts[1].length > 2) return;
                setEditVhf(v);
              }}
              onBlur={() => {
                if (!editVhf) return;
                // Format to xxx.xx on blur
                const num = parseFloat(editVhf);
                if (!isNaN(num) && num >= 0 && num <= 999.99) {
                  setEditVhf(num.toFixed(2));
                }
              }}
              placeholder="123.45"
              className="flex-1 bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent font-mono"
            />
            <span className="text-xs text-gray-500">MHz</span>
          </div>
        </div>

        {/* ROE */}
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Rules of Engagement</label>
          <select value={editRoe} onChange={(e) => setEditRoe(e.target.value)}
            className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
            {ROE_OPTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Assigned units */}
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">Assigned Units ({groupUnits.length})</label>
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {groupUnits.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs text-gray-300 bg-krt-bg/60 rounded px-2 py-0.5">
                <span>{u.callsign ? `[${u.callsign}] ` : ''}{u.name}</span>
                <button onClick={() => removeUnit(u.id)} className="text-red-500 text-[10px] hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
          {unassignedUnits.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) assignUnit(e.target.value); e.target.value = ''; }}
              className="w-full mt-1 bg-krt-panel border border-krt-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-krt-accent"
            >
              <option value="">+ Assign unit…</option>
              {unassignedUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.callsign ? `[${u.callsign}] ` : ''}{u.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={() => setEditing(false)} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
          <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm px-3 py-1 ml-auto">Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => canEdit && setEditing(true)}
      className={`p-3 rounded-lg bg-krt-bg/50 border border-transparent hover:border-krt-border ${canEdit ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
        <span className="text-sm font-medium">{group.name}</span>
        <span className="text-xs text-gray-500 ml-auto">{vehicleCount} 🚀 · {personCount} 👤</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
        <span>{classType?.label || group.class_type}</span>
        {group.vhf_channel && <span className="font-mono text-krt-accent">{group.vhf_channel} MHz</span>}
      </div>
    </div>
  );
}

/* ─── ContactListItem ──────────────── */
function ContactListItem({ contact, inactive, onEdit, canEdit }) {
  const handleDeactivate = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ is_active: !contact.is_active }),
      });
      if (res.ok) useMissionStore.getState().updateContact(await res.json());
    } catch { toast.error('Failed to update contact'); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete contact "${contact.name || 'Unknown'}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { useMissionStore.getState().removeContact(contact.id); toast.success('Contact deleted'); }
    } catch { toast.error('Failed to delete contact'); }
  };

  const iffColor = IFF_COLORS[contact.iff] || IFF_COLORS.unknown;

  return (
    <div className={`p-3 rounded-lg border ${inactive ? 'opacity-50' : ''}`} style={{ backgroundColor: iffColor + '33', borderColor: iffColor + '4D' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: iffColor }} />
          <span className="text-xs font-bold uppercase" style={{ color: iffColor }}>{contact.iff}</span>
          {contact.threat !== 'none' && <span className="text-xs text-red-400">⚠{contact.threat}</span>}
          {contact.confidence && contact.confidence !== 'confirmed' && (
            <span className="text-[10px] text-gray-500 bg-krt-bg px-1 rounded">{contact.confidence}</span>
          )}
        </div>
        <div className="flex gap-1">
          {canEdit && (
            <button onClick={() => onEdit && onEdit(contact)} className="text-xs text-gray-500 hover:text-krt-accent" title="Edit">✏️</button>
          )}
          <button onClick={handleDeactivate} className="text-xs text-gray-500 hover:text-white" title={contact.is_active ? 'Mark inactive' : 'Reactivate'}>
            {contact.is_active ? '👁' : '👁‍🗨'}
          </button>
          <button onClick={handleDelete} className="text-xs text-gray-500 hover:text-red-400" title="Delete">✕</button>
        </div>
      </div>
      <div className="text-sm text-white mt-0.5">{contact.name || 'Unknown'} {contact.count > 1 && `×${contact.count}`}</div>
      <div className="text-xs text-gray-500">{contact.ship_type || 'Unknown ship'} • ({contact.pos_x?.toFixed(0)}, {contact.pos_y?.toFixed(0)}, {contact.pos_z?.toFixed(0)})</div>
      {contact.notes && <div className="text-xs text-gray-400 mt-1 italic">{contact.notes}</div>}
    </div>
  );
}

/* ─── TaskListItem ─────────────────── */
function TaskListItem({ task, completed, onEdit }) {
  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) { useMissionStore.getState().updateTask(await res.json()); toast.success(`Task → ${newStatus}`); }
    } catch { toast.error('Failed to update task'); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) toast.success('Task deleted');
      else toast.error('Failed to delete task');
    } catch { toast.error('Failed to delete task'); }
  };

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal;
  const badgeColor = PRIORITY_BADGE_COLORS[task.priority] || PRIORITY_BADGE_COLORS.normal;

  return (
    <div className={`p-3 rounded-lg border ${completed ? 'opacity-50' : ''}`} style={{ backgroundColor: priorityColor + '1A', borderColor: priorityColor + '33' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: badgeColor }}>{task.priority}</span>
          {task.task_type && task.task_type !== 'custom' && (
            <span className="text-[10px] text-gray-400 bg-krt-bg px-1 rounded">{task.task_type}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{task.status}</span>
          {!completed && onEdit && (
            <button onClick={() => onEdit(task)} className="text-[10px] text-krt-accent hover:text-blue-400" title="Edit task">✏️</button>
          )}
          {!completed && (
            <button onClick={handleDelete} className="text-[10px] text-red-600 hover:text-red-400" title="Delete task">🗑️</button>
          )}
        </div>
      </div>
      <div className={`text-sm text-white mt-1 ${completed ? 'line-through' : ''}`}>{task.title}</div>
      {task.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</div>}
      {(task.assigned_unit_name || task.assigned_group_name) && (
        <div className="text-xs text-gray-500 mt-1">→ {task.assigned_unit_name || task.assigned_group_name}</div>
      )}
      {!completed && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {TASK_STATUS_OPTIONS.filter((s) => s !== task.status).map((s) => (
            <button key={s} onClick={() => handleStatusChange(s)}
              className="text-xs px-1.5 py-0.5 rounded bg-krt-panel border border-krt-border hover:border-krt-accent transition-colors">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── BatchStatusUpdate ────────────── */
function BatchStatusUpdate({ unitIds }) {
  const handleStatusChange = async (newStatus) => {
    try {
      for (const id of unitIds) {
        const res = await fetch(`/api/units/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) useMissionStore.getState().updateUnit(await res.json());
      }
      toast.success(`${unitIds.length} unit(s) → ${newStatus}`);
    } catch { toast.error('Failed to update some units'); }
  };

  return (
    <div className="p-2 bg-krt-bg/50 rounded-lg">
      <p className="text-xs text-gray-400 mb-2">Set status for {unitIds.length} unit(s):</p>
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((status) => (
          <button key={status} onClick={() => handleStatusChange(status)}
            className="text-xs px-2 py-1 rounded bg-krt-panel border border-krt-border hover:border-krt-accent transition-colors">{status}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── CreateUnitForm (with vehicle autocomplete) ── */
const MAP_SCALE = 1e6;
const SPAWNABLE_NAV_TYPES = ['station', 'rest_stop', 'outpost'];
const UNIT_TYPES = [
  { value: 'ship', label: '🚀 Ship' },
  { value: 'ground_vehicle', label: '🚗 Ground Vehicle' },
];

function CreateUnitForm({ missionId, groups, onClose }) {
  const { navData, units } = useMissionStore();
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [shipType, setShipType] = useState('');
  const [unitType, setUnitType] = useState('ship');
  const [groupId, setGroupId] = useState('');
  const [stationId, setStationId] = useState('');
  const [parentUnitId, setParentUnitId] = useState('');
  const [role, setRole] = useState('');
  const [crewCount, setCrewCount] = useState(1);
  const [crewMax, setCrewMax] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Vehicle name search / dropdown state
  const [vehicleList, setVehicleList] = useState([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const vehicleRef = useRef(null);

  // Fetch vehicle names when unitType is ship or ground_vehicle
  useEffect(() => {
    if (unitType === 'person') { setVehicleList([]); return; }
    const category = unitType === 'ground_vehicle' ? 'ground_vehicle' : 'ship';
    fetch(`/api/ship-images/names?category=${category}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setVehicleList(Array.isArray(data) ? data : []))
      .catch(() => setVehicleList([]));
  }, [unitType]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (vehicleRef.current && !vehicleRef.current.contains(e.target)) {
        setShowVehicleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filter vehicle list by search text
  const filteredVehicles = vehicleSearch
    ? vehicleList.filter((v) =>
        v.ship_type.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
        (v.manufacturer && v.manufacturer.toLowerCase().includes(vehicleSearch.toLowerCase()))
      )
    : vehicleList;

  // Group filtered vehicles by manufacturer
  const groupedVehicles = filteredVehicles.reduce((acc, v) => {
    const mfr = v.manufacturer || 'Unknown';
    if (!acc[mfr]) acc[mfr] = [];
    acc[mfr].push(v);
    return acc;
  }, {});

  const availableShips = units.filter((u) => (u.unit_type === 'ship' || u.unit_type === 'ground_vehicle') && u.mission_id === missionId);

  const spawnLocations = (navData?.points || [])
    .filter((p) => SPAWNABLE_NAV_TYPES.includes(p.nav_type) && p.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    let spawnX = 0, spawnY = 0, spawnZ = 0;
    if (unitType === 'person' && parentUnitId) {
      const p = units.find((u) => u.id === parentUnitId);
      if (p) { spawnX = p.pos_x || 0; spawnY = p.pos_y || 0; spawnZ = p.pos_z || 0; }
    } else {
      if (!stationId) { setError('Please select a starting location'); return; }
      const station = spawnLocations.find((p) => p.id === stationId);
      spawnX = station ? (station.pos_x || 0) / MAP_SCALE : 0;
      spawnY = station ? (station.pos_y || 0) / MAP_SCALE : 0;
      spawnZ = station ? (station.pos_z || 0) / MAP_SCALE : 0;
    }
    setSubmitting(true); setError(null);
    const finalShipType = shipType || vehicleSearch || null;
    try {
      const res = await fetch('/api/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          name: name.trim(), callsign: callsign || null, ship_type: finalShipType,
          unit_type: unitType, mission_id: missionId, group_id: groupId || null,
          parent_unit_id: parentUnitId || null, role: role || null,
          crew_count: crewCount, crew_max: crewMax ? parseInt(crewMax) : null,
          pos_x: spawnX, pos_y: spawnY, pos_z: spawnZ,
        }),
      });
      if (res.ok) { toast.success('Unit created'); onClose(); }
      else {
        const data = await res.json().catch(() => null);
        const msg = data?.details?.map((d) => d.message).join(', ') || data?.error || `Error ${res.status}`;
        setError(msg); toast.error(`Failed: ${msg}`);
      }
    } catch { setError('Network error'); toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit name *"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" autoFocus />
        <input type="text" value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="Callsign"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={unitType} onChange={(e) => { setUnitType(e.target.value); setShipType(''); setVehicleSearch(''); }}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
          {UNIT_TYPES.map((ut) => <option key={ut.value} value={ut.value}>{ut.label}</option>)}
        </select>
        {unitType !== 'person' ? (
          <div className="relative" ref={vehicleRef}>
            <input
              type="text"
              value={shipType || vehicleSearch}
              onChange={(e) => { setVehicleSearch(e.target.value); setShipType(''); setShowVehicleDropdown(true); }}
              onFocus={() => setShowVehicleDropdown(true)}
              placeholder={unitType === 'ground_vehicle' ? 'Search vehicle…' : 'Search ship…'}
              className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
            />
            {shipType && (
              <button type="button" onClick={() => { setShipType(''); setVehicleSearch(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">✕</button>
            )}
            {showVehicleDropdown && filteredVehicles.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-krt-panel border border-krt-border rounded shadow-lg">
                {Object.entries(groupedVehicles).map(([mfr, vehicles]) => (
                  <div key={mfr}>
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-500 bg-krt-bg/60 sticky top-0">{mfr}</div>
                    {vehicles.map((v) => (
                      <button key={v.ship_type} type="button"
                        onClick={() => { setShipType(v.ship_type); setVehicleSearch(''); setShowVehicleDropdown(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-krt-accent/20 transition-colors">
                        {v.ship_type}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {showVehicleDropdown && vehicleSearch && filteredVehicles.length === 0 && (
              <div className="absolute z-50 mt-1 w-full bg-krt-panel border border-krt-border rounded shadow-lg px-3 py-2 text-xs text-gray-500">
                No matches — type will be used as-is
              </div>
            )}
          </div>
        ) : (
          <input type="text" value={shipType} onChange={(e) => setShipType(e.target.value)} placeholder="Equipment (optional)"
            className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" />
        )}
      </div>
      <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Fighter escort)"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" />
      <select value={stationId} onChange={(e) => setStationId(e.target.value)}
        disabled={unitType === 'person' && !!parentUnitId}
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
        <option value="">{unitType === 'person' && parentUnitId ? 'Position inherited from ship' : 'Starting location *'}</option>
        {spawnLocations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name} ({loc.nav_type.replace('_', ' ')})</option>)}
      </select>
      {unitType === 'person' && (
        <select value={parentUnitId} onChange={(e) => { setParentUnitId(e.target.value); if (e.target.value) setStationId(''); }}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
          <option value="">Aboard ship (optional)</option>
          {availableShips.map((s) => <option key={s.id} value={s.id}>{s.callsign ? `[${s.callsign}] ` : ''}{s.name}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
          <option value="">No group</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <div className="flex gap-1">
          <input type="number" value={crewCount} onChange={(e) => setCrewCount(Math.max(0, parseInt(e.target.value) || 0))} placeholder="Crew" min={0}
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent" />
          <input type="number" value={crewMax} onChange={(e) => setCrewMax(e.target.value)} placeholder="Max" min={0}
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">{submitting ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
      </div>
    </form>
  );
}

/* ─── CreateGroupForm ──────────────── */
function CreateGroupForm({ missionId, onClose }) {
  const [name, setName] = useState('');
  const [classType, setClassType] = useState('CUSTOM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const mType = CLASS_TYPES.find((m) => m.value === classType);
      const res = await fetch('/api/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: name.trim(), mission_id: missionId, class_type: classType, color: mType?.color || '#3b82f6' }),
      });
      if (res.ok) { toast.success('Group created'); onClose(); }
      else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed'); toast.error('Failed');
      }
    } catch { setError('Network error'); toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" autoFocus />
      <select value={classType} onChange={(e) => setClassType(e.target.value)}
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
        {CLASS_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">{submitting ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
      </div>
    </form>
  );
}


/* ═══════════════════════════════════════════════════════════
   Popup panels — each wraps content in a <PopupWindow>
   ═══════════════════════════════════════════════════════════ */

function UnitsPopup({ missionId }) {
  const { units, groups, selectedUnitIds, searchQuery, statusFilter, myMissionRole } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const canCreateUnits = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  // Only show ships and ground vehicles — persons have their own panel
  const vehicleUnits = units.filter((u) => u.unit_type !== 'person');

  const filtered = vehicleUnits.filter((u) => {
    if (statusFilter.length > 0 && !statusFilter.includes(u.status)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const group = groups.find((g) => g.id === u.group_id);
      // Also search names of persons assigned to this unit
      const personsAboard = units.filter((p) => p.unit_type === 'person' && p.parent_unit_id === u.id);
      const personMatch = personsAboard.some((p) => p.name.toLowerCase().includes(q));
      return u.name.toLowerCase().includes(q) || (u.ship_type && u.ship_type.toLowerCase().includes(q)) || (group && group.name.toLowerCase().includes(q)) || personMatch;
    }
    return true;
  });

  return (
    <PopupWindow id="units">
      <SearchFilter />
      <div className="space-y-2 mt-2">
        {canCreateUnits && (
          <button onClick={() => setShowCreate(!showCreate)} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ Add Unit</button>
        )}
        {showCreate && <CreateUnitForm missionId={missionId} groups={groups} onClose={() => setShowCreate(false)} />}
        {filtered.map((unit) => {
          const group = groups.find((g) => g.id === unit.group_id);
          return <UnitListItem key={unit.id} unit={unit} group={group} isSelected={selectedUnitIds.includes(unit.id)} />;
        })}
      </div>
    </PopupWindow>
  );
}

function GroupsPopup({ missionId }) {
  const { units, groups, myMissionRole } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = myMissionRole === 'gesamtlead';

  return (
    <PopupWindow id="groups">
      <div className="space-y-2">
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ Add Group</button>
        )}
        {showCreate && <CreateGroupForm missionId={missionId} onClose={() => setShowCreate(false)} />}
        {groups.map((group) => {
          const groupUnits = units.filter((u) => u.group_id === group.id);
          const vehicles = groupUnits.filter((u) => u.unit_type !== 'person');
          const vehicleIds = new Set(vehicles.map((v) => v.id));
          const personsAboard = units.filter((p) => p.unit_type === 'person' && p.parent_unit_id && vehicleIds.has(p.parent_unit_id)).length;
          return <GroupListItem key={group.id} group={group} vehicleCount={vehicles.length} personCount={personsAboard} canEdit={canCreate} />;
        })}
      </div>
    </PopupWindow>
  );
}

function ContactsPopup({ missionId }) {
  const { contacts, myMissionRole } = useMissionStore();
  const [showSpotrep, setShowSpotrep] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const canCreate = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setShowSpotrep(false);
  };

  return (
    <PopupWindow id="contacts">
      <div className="space-y-2">
        {canCreate && !editingContact && (
          <button onClick={() => { setShowSpotrep(!showSpotrep); setEditingContact(null); }} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ File SPOTREP</button>
        )}
        {showSpotrep && !editingContact && <SpotrepForm missionId={missionId} onClose={() => setShowSpotrep(false)} />}
        {editingContact && (
          <SpotrepForm missionId={missionId} contact={editingContact} onClose={() => setEditingContact(null)} />
        )}
        {contacts.filter((c) => c.is_active).length === 0 && !showSpotrep && !editingContact && (
          <p className="text-gray-500 text-sm text-center py-4">No active contacts.</p>
        )}
        {contacts.filter((c) => c.is_active).map((contact) => (
          <ContactListItem key={contact.id} contact={contact} onEdit={handleEdit} canEdit={canCreate} />
        ))}
        {contacts.filter((c) => !c.is_active).length > 0 && (
          <div className="pt-2 border-t border-krt-border">
            <p className="text-xs text-gray-600 mb-1">Inactive ({contacts.filter((c) => !c.is_active).length})</p>
            {contacts.filter((c) => !c.is_active).map((contact) => (
              <ContactListItem key={contact.id} contact={contact} inactive onEdit={handleEdit} canEdit={canCreate} />
            ))}
          </div>
        )}
      </div>
    </PopupWindow>
  );
}

function TasksPopup({ missionId }) {
  const { tasks, myMissionRole } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const canCreate = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  const active = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  const handleEdit = (task) => {
    setShowCreate(false);
    setEditingTask(task);
  };

  return (
    <PopupWindow id="tasks">
      <div className="space-y-2">
        {canCreate && !editingTask && (
          <button onClick={() => { setShowCreate(!showCreate); setEditingTask(null); }} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ Create Task</button>
        )}
        {showCreate && !editingTask && <TaskForm missionId={missionId} onClose={() => setShowCreate(false)} />}
        {editingTask && (
          <TaskForm missionId={missionId} task={editingTask} onClose={() => setEditingTask(null)} />
        )}
        {active.length === 0 && !showCreate && !editingTask && (
          <p className="text-gray-500 text-sm text-center py-4">No active tasks.</p>
        )}
        {active.map((task) => <TaskListItem key={task.id} task={task} onEdit={canCreate ? handleEdit : undefined} />)}
        {done.length > 0 && (
          <div className="pt-2 border-t border-krt-border">
            <p className="text-xs text-gray-600 mb-1">Completed ({done.length})</p>
            {done.map((task) => <TaskListItem key={task.id} task={task} completed />)}
          </div>
        )}
      </div>
    </PopupWindow>
  );
}

function SelectedPopup() {
  const { units, groups, selectedUnitIds, clearSelection } = useMissionStore();
  const selectedUnits = units.filter((u) => selectedUnitIds.includes(u.id));

  return (
    <PopupWindow id="selected">
      <div className="space-y-2">
        {selectedUnits.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Click units on the map to select them</p>
        ) : (
          <>
            <button onClick={clearSelection} className="text-sm text-gray-400 hover:text-white">Clear selection</button>
            <BatchStatusUpdate unitIds={selectedUnitIds} />
            {selectedUnits.map((unit) => {
              const group = groups.find((g) => g.id === unit.group_id);
              return <UnitListItem key={unit.id} unit={unit} group={group} isSelected />;
            })}
          </>
        )}
      </div>
    </PopupWindow>
  );
}

function OpsPopup({ missionId }) {
  return (
    <PopupWindow id="ops">
      <OperationPanel missionId={missionId} />
    </PopupWindow>
  );
}

function CommsPopup({ missionId }) {
  return (
    <PopupWindow id="comms">
      <QuickMessages missionId={missionId} />
    </PopupWindow>
  );
}

function LogPopup({ missionId }) {
  return (
    <PopupWindow id="log">
      <EventLog missionId={missionId} />
    </PopupWindow>
  );
}

function BookmarksPopup({ missionId }) {
  return (
    <PopupWindow id="bookmarks">
      <BookmarkPanel missionId={missionId} />
    </PopupWindow>
  );
}

function MultiplayerPopup({ missionId }) {
  return (
    <PopupWindow id="multiplayer">
      <MultiplayerPanel missionId={missionId} />
    </PopupWindow>
  );
}

/* ─── PersonListItem ───────────────── */
function PersonListItem({ person, group, isSelected }) {
  const { toggleSelectUnit, focusUnit } = useMissionStore();
  const { openPersonDetail } = usePopupStore();
  const parentShip = person.parent_unit_id ? useMissionStore.getState().units.find((u) => u.id === person.parent_unit_id) : null;

  return (
    <div
      onClick={() => toggleSelectUnit(person.id)}
      onDoubleClick={() => openPersonDetail(person.id)}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-krt-accent/10 border border-krt-accent/30'
          : 'bg-krt-bg/50 border border-transparent hover:border-krt-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">
          <span className="mr-1">🧑</span>
          {person.callsign ? `[${person.callsign}] ` : ''}{person.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); focusUnit(person.id); }}
            className="text-gray-500 hover:text-krt-accent text-xs"
            title="Focus on map"
          >🎯</button>
          <StatusBadge status={person.status} />
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {person.role && <span>{person.role}</span>}
        {parentShip && <span className={person.role ? 'ml-1' : ''}>• @ {parentShip.callsign ? `[${parentShip.callsign}]` : parentShip.name}</span>}
        {group && <span className="ml-1">• {group.name}</span>}
      </div>
    </div>
  );
}

/* ─── CreatePersonForm ─────────────── */
function CreatePersonForm({ missionId, groups, onClose }) {
  const { units, navData } = useMissionStore();
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [role, setRole] = useState('');
  const [groupId, setGroupId] = useState('');
  const [parentUnitId, setParentUnitId] = useState('');
  const [stationId, setStationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const MAP_SCALE = 1e6;
  const SPAWNABLE_NAV_TYPES = ['station', 'rest_stop', 'outpost'];
  const availableShips = units.filter((u) => (u.unit_type === 'ship' || u.unit_type === 'ground_vehicle') && u.mission_id === missionId);
  const spawnLocations = (navData?.points || [])
    .filter((p) => SPAWNABLE_NAV_TYPES.includes(p.nav_type) && p.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    let spawnX = 0, spawnY = 0, spawnZ = 0;
    if (parentUnitId) {
      const p = units.find((u) => u.id === parentUnitId);
      if (p) { spawnX = p.pos_x || 0; spawnY = p.pos_y || 0; spawnZ = p.pos_z || 0; }
    } else if (stationId) {
      const station = spawnLocations.find((p) => p.id === stationId);
      spawnX = station ? (station.pos_x || 0) / MAP_SCALE : 0;
      spawnY = station ? (station.pos_y || 0) / MAP_SCALE : 0;
      spawnZ = station ? (station.pos_z || 0) / MAP_SCALE : 0;
    } else {
      setError('Please select a location or a ship to board'); return;
    }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          name: name.trim(), callsign: callsign || null,
          unit_type: 'person', mission_id: missionId, group_id: groupId || null,
          parent_unit_id: parentUnitId || null, role: role || null,
          pos_x: spawnX, pos_y: spawnY, pos_z: spawnZ,
        }),
      });
      if (res.ok) { toast.success('Person created'); onClose(); }
      else {
        const data = await res.json().catch(() => null);
        const msg = data?.details?.map((d) => d.message).join(', ') || data?.error || `Error ${res.status}`;
        setError(msg); toast.error(`Failed: ${msg}`);
      }
    } catch { setError('Network error'); toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Person name *"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" autoFocus />
        <input type="text" value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="Callsign"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" />
      </div>
      <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Pilot, Engineer)"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" />
      <select value={parentUnitId} onChange={(e) => { setParentUnitId(e.target.value); if (e.target.value) setStationId(''); }}
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
        <option value="">Board a ship (optional)</option>
        {availableShips.map((s) => <option key={s.id} value={s.id}>{s.callsign ? `[${s.callsign}] ` : ''}{s.name}</option>)}
      </select>
      {!parentUnitId && (
        <select value={stationId} onChange={(e) => setStationId(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
          <option value="">Starting location *</option>
          {spawnLocations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name} ({loc.nav_type.replace('_', ' ')})</option>)}
        </select>
      )}
      <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
        <option value="">No group</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">{submitting ? 'Creating…' : 'Create Person'}</button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
      </div>
    </form>
  );
}

/* ─── PersonsPopup ─────────────────── */
function PersonsPopup({ missionId }) {
  const { units, groups, selectedUnitIds, searchQuery, myMissionRole } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  const persons = units.filter((u) => u.unit_type === 'person');
  const filtered = persons.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const group = groups.find((g) => g.id === p.group_id);
      return p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q)) || (group && group.name.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <PopupWindow id="persons">
      <div className="space-y-2">
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ Add Person</button>
        )}
        {showCreate && <CreatePersonForm missionId={missionId} groups={groups} onClose={() => setShowCreate(false)} />}
        {filtered.length === 0 && !showCreate && (
          <p className="text-gray-500 text-sm text-center py-4">No persons. Add crew members here.</p>
        )}
        {filtered.map((person) => {
          const group = groups.find((g) => g.id === person.group_id);
          return <PersonListItem key={person.id} person={person} group={group} isSelected={selectedUnitIds.includes(person.id)} />;
        })}
      </div>
    </PopupWindow>
  );
}

function UnitDetailPopup() {
  const detailUnitId = usePopupStore((s) => s.detailUnitId);
  const closeUnitDetail = usePopupStore((s) => s.closeUnitDetail);

  return (
    <PopupWindow id="unitDetail">
      {detailUnitId ? (
        <UnitDetailPanel unitId={detailUnitId} onClose={closeUnitDetail} />
      ) : (
        <p className="text-gray-500 text-sm text-center py-4">No unit selected</p>
      )}
    </PopupWindow>
  );
}

function PersonDetailPopup() {
  const detailPersonId = usePopupStore((s) => s.detailPersonId);
  const closePersonDetail = usePopupStore((s) => s.closePersonDetail);

  return (
    <PopupWindow id="personDetail">
      {detailPersonId ? (
        <PersonDetailPanel unitId={detailPersonId} onClose={closePersonDetail} />
      ) : (
        <p className="text-gray-500 text-sm text-center py-4">No person selected</p>
      )}
    </PopupWindow>
  );
}
