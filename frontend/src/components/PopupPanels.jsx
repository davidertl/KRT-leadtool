import React, { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { usePopupStore } from '../stores/popupStore';
import PopupWindow from './PopupWindow';
import SearchFilter from './SearchFilter';
import UnitDetailPanel from './UnitDetailPanel';
import SpotrepForm from './SpotrepForm';
import TaskForm from './TaskForm';
import OperationPanel from './OperationPanel';
import EventLog from './EventLog';
import QuickMessages from './QuickMessages';
import BookmarkPanel from './BookmarkPanel';
import MultiplayerPanel from './MultiplayerPanel';
import toast from 'react-hot-toast';

/**
 * All popup windows for the map view.
 * Each wraps the corresponding panel inside a PopupWindow.
 */
export default function PopupPanels() {
  const { missionId } = useMissionStore();

  return (
    <>
      <UnitsPopup missionId={missionId} />
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
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared constants & sub-components (from Sidebar)
   ═══════════════════════════════════════════════════════════ */

const CLASS_TYPES = [
  { value: 'SAR', label: '🔍 Search & Rescue', color: '#f59e0b' },
  { value: 'POV', label: '🚗 POV', color: '#64748b' },
  { value: 'FIGHTER', label: '⚔️ Fighter', color: '#ef4444' },
  { value: 'MINER', label: '⛏️ Mining', color: '#a855f7' },
  { value: 'TRANSPORT', label: '📦 Transport', color: '#22c55e' },
  { value: 'RECON', label: '👁️ Recon', color: '#06b6d4' },
  { value: 'LOGISTICS', label: '🔧 Logistics', color: '#f97316' },
  { value: 'CUSTOM', label: '📌 Custom', color: '#6b7280' },
];

const STATUS_OPTIONS = ['boarding', 'ready_for_takeoff', 'on_the_way', 'arrived', 'ready_for_orders', 'in_combat', 'heading_home', 'disabled'];

const IFF_COLORS = {
  friendly: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' },
  hostile: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
  neutral: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  unknown: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' },
};

const PRIORITY_COLORS_MAP = {
  low: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', badge: 'bg-gray-600' },
  normal: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', badge: 'bg-blue-600' },
  high: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', badge: 'bg-yellow-600' },
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', badge: 'bg-red-600' },
};

const TASK_STATUS_OPTIONS = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

/* ─── StatusBadge ──────────────────── */
function StatusBadge({ status }) {
  const colors = {
    boarding: 'bg-purple-500',
    ready_for_takeoff: 'bg-blue-500',
    on_the_way: 'bg-cyan-500',
    arrived: 'bg-green-500',
    ready_for_orders: 'bg-yellow-500',
    in_combat: 'bg-red-500',
    heading_home: 'bg-orange-500',
    disabled: 'bg-gray-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] || 'bg-gray-500'}`}>
      {status}
    </span>
  );
}

/* ─── UnitListItem ─────────────────── */
function UnitListItem({ unit, group, isSelected }) {
  const { toggleSelectUnit, focusUnit } = useMissionStore();
  const { openUnitDetail } = usePopupStore();

  return (
    <div
      onClick={() => toggleSelectUnit(unit.id)}
      onDoubleClick={() => openUnitDetail(unit.id)}
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
function GroupListItem({ group, unitCount, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editClassType, setEditClassType] = useState(group.class_type);
  const [saving, setSaving] = useState(false);

  const classType = CLASS_TYPES.find((m) => m.value === group.class_type);

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const mType = CLASS_TYPES.find((m) => m.value === editClassType);
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), class_type: editClassType, color: mType?.color || group.color }),
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

  if (editing) {
    return (
      <div className="p-3 rounded-lg bg-krt-bg/80 border border-krt-accent/40 space-y-2">
        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent" autoFocus />
        <select value={editClassType} onChange={(e) => setEditClassType(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent">
          {CLASS_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
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
        <span className="text-xs text-gray-500 ml-auto">{unitCount} units</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">{classType?.label || group.class_type}</div>
    </div>
  );
}

/* ─── ContactListItem ──────────────── */
function ContactListItem({ contact, inactive }) {
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
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { useMissionStore.getState().removeContact(contact.id); toast.success('Contact deleted'); }
    } catch { toast.error('Failed to delete contact'); }
  };

  const colors = IFF_COLORS[contact.iff] || IFF_COLORS.unknown;

  return (
    <div className={`p-3 rounded-lg border ${inactive ? 'opacity-50' : ''} ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className={`text-xs font-bold uppercase ${colors.text}`}>{contact.iff}</span>
          {contact.threat !== 'none' && <span className="text-xs text-red-400">⚠{contact.threat}</span>}
          {contact.confidence && contact.confidence !== 'confirmed' && (
            <span className="text-[10px] text-gray-500 bg-krt-bg px-1 rounded">{contact.confidence}</span>
          )}
        </div>
        <div className="flex gap-1">
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
function TaskListItem({ task, completed }) {
  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) { useMissionStore.getState().updateTask(await res.json()); toast.success(`Task → ${newStatus}`); }
    } catch { toast.error('Failed to update task'); }
  };

  const colors = PRIORITY_COLORS_MAP[task.priority] || PRIORITY_COLORS_MAP.normal;

  return (
    <div className={`p-3 rounded-lg border ${completed ? 'opacity-50' : ''} ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={`text-xs px-1.5 py-0.5 rounded ${colors.badge} text-white`}>{task.priority}</span>
          {task.task_type && task.task_type !== 'custom' && (
            <span className="text-[10px] text-gray-400 bg-krt-bg px-1 rounded">{task.task_type}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">{task.status}</span>
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
  { value: 'person', label: '🧑 Person' },
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

  const filtered = units.filter((u) => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const group = groups.find((g) => g.id === u.group_id);
      return u.name.toLowerCase().includes(q) || (u.ship_type && u.ship_type.toLowerCase().includes(q)) || (group && group.name.toLowerCase().includes(q));
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
          return <GroupListItem key={group.id} group={group} unitCount={groupUnits.length} canEdit={canCreate} />;
        })}
      </div>
    </PopupWindow>
  );
}

function ContactsPopup({ missionId }) {
  const { contacts, myMissionRole } = useMissionStore();
  const [showSpotrep, setShowSpotrep] = useState(false);
  const canCreate = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  return (
    <PopupWindow id="contacts">
      <div className="space-y-2">
        {canCreate && (
          <button onClick={() => setShowSpotrep(!showSpotrep)} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ File SPOTREP</button>
        )}
        {showSpotrep && <SpotrepForm missionId={missionId} onClose={() => setShowSpotrep(false)} />}
        {contacts.filter((c) => c.is_active).length === 0 && !showSpotrep && (
          <p className="text-gray-500 text-sm text-center py-4">No active contacts.</p>
        )}
        {contacts.filter((c) => c.is_active).map((contact) => (
          <ContactListItem key={contact.id} contact={contact} />
        ))}
        {contacts.filter((c) => !c.is_active).length > 0 && (
          <div className="pt-2 border-t border-krt-border">
            <p className="text-xs text-gray-600 mb-1">Inactive ({contacts.filter((c) => !c.is_active).length})</p>
            {contacts.filter((c) => !c.is_active).map((contact) => (
              <ContactListItem key={contact.id} contact={contact} inactive />
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
  const canCreate = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  const active = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'completed' || t.status === 'cancelled');

  return (
    <PopupWindow id="tasks">
      <div className="space-y-2">
        {canCreate && (
          <button onClick={() => setShowCreate(!showCreate)} className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1">+ Create Task</button>
        )}
        {showCreate && <TaskForm missionId={missionId} onClose={() => setShowCreate(false)} />}
        {active.length === 0 && !showCreate && (
          <p className="text-gray-500 text-sm text-center py-4">No active tasks.</p>
        )}
        {active.map((task) => <TaskListItem key={task.id} task={task} />)}
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
