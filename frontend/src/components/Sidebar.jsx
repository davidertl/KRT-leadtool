import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { useAuthStore } from '../stores/authStore';
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

const MISSION_TYPES = [
  { value: 'SAR', label: '🔍 Search & Rescue', color: '#f59e0b' },
  { value: 'FIGHTER', label: '⚔️ Fighter', color: '#ef4444' },
  { value: 'MINER', label: '⛏️ Mining', color: '#a855f7' },
  { value: 'TRANSPORT', label: '📦 Transport', color: '#22c55e' },
  { value: 'RECON', label: '👁️ Recon', color: '#06b6d4' },
  { value: 'LOGISTICS', label: '🔧 Logistics', color: '#f97316' },
  { value: 'CUSTOM', label: '📌 Custom', color: '#6b7280' },
];

const STATUS_OPTIONS = ['idle', 'en_route', 'on_station', 'engaged', 'rtb', 'disabled'];

export default function Sidebar({ onBack }) {
  const { user } = useAuthStore();
  const { teamId, units, groups, contacts, tasks, operations, events, messages, bookmarks, joinRequests, selectedUnitIds, clearSelection, searchQuery, statusFilter, myMissionRole, canEdit } = useMissionStore();
  const [tab, setTab] = useState('units');
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSpotrep, setShowSpotrep] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [detailUnitId, setDetailUnitId] = useState(null);

  // Permission helpers
  const isGesamtlead = myMissionRole === 'gesamtlead';
  const isGruppenlead = myMissionRole === 'gruppenlead';
  const isTeamlead = myMissionRole === 'teamlead';
  const canCreateUnits = isGesamtlead || isGruppenlead;
  const canCreateGroups = isGesamtlead;
  const canCreateContacts = isGesamtlead || isGruppenlead;
  const canCreateTasks = isGesamtlead || isGruppenlead;

  const selectedUnits = units.filter((u) => selectedUnitIds.includes(u.id));

  // Apply search and status filters
  const filteredUnits = units.filter((u) => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const group = groups.find((g) => g.id === u.group_id);
      return (
        u.name.toLowerCase().includes(q) ||
        (u.ship_type && u.ship_type.toLowerCase().includes(q)) ||
        (group && group.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="w-80 bg-krt-panel border-r border-krt-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-krt-border flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors"
          title="Back to dashboard"
        >
          ← Back
        </button>
        <h2 className="font-bold text-lg flex-1 truncate">Mission</h2>
        <div className="text-right">
          <span className="text-xs text-gray-500 block">{user?.username}</span>
          {myMissionRole && (
            <span className={`text-[10px] font-bold ${
              myMissionRole === 'gesamtlead' ? 'text-red-400' :
              myMissionRole === 'gruppenlead' ? 'text-yellow-400' : 'text-blue-400'
            }`}>
              {myMissionRole === 'gesamtlead' ? 'Gesamtlead' :
               myMissionRole === 'gruppenlead' ? 'Gruppenlead' : 'Teamlead'}
            </span>
          )}
        </div>
      </div>

      {/* Tabs — two rows */}
      <div className="border-b border-krt-border">
        <div className="flex overflow-x-auto">
          {['units', 'groups', 'contacts', 'tasks', 'selected'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setDetailUnitId(null); }}
              className={`flex-1 py-2 text-xs font-medium transition-colors whitespace-nowrap px-1 ${
                tab === t
                  ? 'text-krt-accent border-b-2 border-krt-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'units' && `Units (${units.length})`}
              {t === 'groups' && `Groups (${groups.length})`}
              {t === 'contacts' && `IFF (${contacts.filter(c => c.is_active).length})`}
              {t === 'tasks' && `Tasks (${tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length})`}
              {t === 'selected' && `Sel (${selectedUnitIds.length})`}
            </button>
          ))}
        </div>
        <div className="flex overflow-x-auto">
          {['ops', 'comms', 'log', 'bookmarks', 'multiplayer'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setDetailUnitId(null); }}
              className={`flex-1 py-1.5 text-[10px] font-medium transition-colors whitespace-nowrap px-1 ${
                tab === t
                  ? 'text-krt-accent border-b-2 border-krt-accent'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {t === 'ops' && `🎯 Ops ${operations.filter(o => o.phase !== 'complete').length > 0 ? '●' : ''}`}
              {t === 'comms' && `📡 Comms`}
              {t === 'log' && `📜 Log (${events.length})`}
              {t === 'bookmarks' && `📌 Marks (${bookmarks.length})`}
              {t === 'multiplayer' && `👥 MP${joinRequests.length > 0 ? ` (${joinRequests.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* Search filter (shown on units tab) */}
      {tab === 'units' && <SearchFilter />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Unit detail panel (overlays the list when active) */}
        {detailUnitId && (
          <UnitDetailPanel unitId={detailUnitId} onClose={() => setDetailUnitId(null)} />
        )}

        {/* Units tab */}
        {!detailUnitId && tab === 'units' && (
          <div className="space-y-2">
            {canCreateUnits && (
              <button
                onClick={() => setShowCreateUnit(!showCreateUnit)}
                className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
              >
                + Add Unit
              </button>
            )}

            {showCreateUnit && (
              <CreateUnitForm
                teamId={teamId}
                groups={groups}
                onClose={() => setShowCreateUnit(false)}
              />
            )}

            {filteredUnits.map((unit) => {
              const group = groups.find((g) => g.id === unit.group_id);
              return (
                <UnitListItem
                  key={unit.id}
                  unit={unit}
                  group={group}
                  isSelected={selectedUnitIds.includes(unit.id)}
                  onDoubleClick={() => setDetailUnitId(unit.id)}
                />
              );
            })}
          </div>
        )}

        {/* Groups tab */}
        {tab === 'groups' && (
          <div className="space-y-2">
            {canCreateGroups && (
              <button
                onClick={() => setShowCreateGroup(!showCreateGroup)}
                className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
              >
                + Add Group
              </button>
            )}

            {showCreateGroup && (
              <CreateGroupForm teamId={teamId} onClose={() => setShowCreateGroup(false)} />
            )}

            {groups.map((group) => {
              const groupUnits = units.filter((u) => u.group_id === group.id);
              return (
                <GroupListItem key={group.id} group={group} unitCount={groupUnits.length} />
              );
            })}
          </div>
        )}

        {/* Contacts / IFF tab */}
        {!detailUnitId && tab === 'contacts' && (
          <div className="space-y-2">
            {canCreateContacts && (
              <button
                onClick={() => setShowSpotrep(!showSpotrep)}
                className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
            >
              + File SPOTREP
            </button>
            )}

            {showSpotrep && (
              <SpotrepForm teamId={teamId} onClose={() => setShowSpotrep(false)} />
            )}

            {contacts.filter(c => c.is_active).length === 0 && !showSpotrep && (
              <p className="text-gray-500 text-sm text-center py-4">
                No active contacts. File a SPOTREP to report one.
              </p>
            )}

            {contacts.filter(c => c.is_active).map((contact) => (
              <ContactListItem key={contact.id} contact={contact} />
            ))}

            {contacts.filter(c => !c.is_active).length > 0 && (
              <div className="pt-2 border-t border-krt-border">
                <p className="text-xs text-gray-600 mb-1">Inactive ({contacts.filter(c => !c.is_active).length})</p>
                {contacts.filter(c => !c.is_active).map((contact) => (
                  <ContactListItem key={contact.id} contact={contact} inactive />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tasks tab */}
        {!detailUnitId && tab === 'tasks' && (
          <div className="space-y-2">
            {canCreateTasks && (
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
              >
                + Create Task
              </button>
            )}

            {showTaskForm && (
              <TaskForm teamId={teamId} onClose={() => setShowTaskForm(false)} />
            )}

            {tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length === 0 && !showTaskForm && (
              <p className="text-gray-500 text-sm text-center py-4">
                No active tasks. Create one to assign orders.
              </p>
            )}

            {tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map((task) => (
              <TaskListItem key={task.id} task={task} />
            ))}

            {tasks.filter(t => t.status === 'completed' || t.status === 'cancelled').length > 0 && (
              <div className="pt-2 border-t border-krt-border">
                <p className="text-xs text-gray-600 mb-1">
                  Completed ({tasks.filter(t => t.status === 'completed' || t.status === 'cancelled').length})
                </p>
                {tasks.filter(t => t.status === 'completed' || t.status === 'cancelled').map((task) => (
                  <TaskListItem key={task.id} task={task} completed />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected tab */}
        {tab === 'selected' && (
          <div className="space-y-2">
            {selectedUnits.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                Click on units in the map to select them
              </p>
            ) : (
              <>
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Clear selection
                </button>
                <BatchStatusUpdate unitIds={selectedUnitIds} teamId={teamId} />
                {selectedUnits.map((unit) => {
                  const group = groups.find((g) => g.id === unit.group_id);
                  return (
                    <UnitListItem key={unit.id} unit={unit} group={group} isSelected
                      onDoubleClick={() => setDetailUnitId(unit.id)}
                    />
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Operations tab */}
        {tab === 'ops' && <OperationPanel teamId={teamId} />}

        {/* Comms tab */}
        {tab === 'comms' && <QuickMessages teamId={teamId} />}

        {/* Event log tab */}
        {tab === 'log' && <EventLog teamId={teamId} />}

        {/* Bookmarks tab */}
        {tab === 'bookmarks' && <BookmarkPanel teamId={teamId} />}

        {/* Multiplayer tab */}
        {tab === 'multiplayer' && <MultiplayerPanel teamId={teamId} />}
      </div>
    </div>
  );
}

/** Single unit in the sidebar list */
function UnitListItem({ unit, group, isSelected, onDoubleClick }) {
  const { toggleSelectUnit, focusUnit } = useMissionStore();

  return (
    <div
      onClick={() => toggleSelectUnit(unit.id)}
      onDoubleClick={onDoubleClick}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-krt-accent/10 border border-krt-accent/30'
          : 'bg-krt-bg/50 border border-transparent hover:border-krt-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{unit.callsign ? `[${unit.callsign}] ` : ''}{unit.name}</span>
        <div className="flex items-center gap-1">
          {/* Resource warnings */}
          {unit.fuel != null && unit.fuel <= 25 && <span className="text-[10px]" title={`Fuel: ${unit.fuel}%`}>⛽</span>}
          {unit.ammo != null && unit.ammo <= 25 && <span className="text-[10px]" title={`Ammo: ${unit.ammo}%`}>💨</span>}
          {unit.hull != null && unit.hull <= 25 && <span className="text-[10px]" title={`Hull: ${unit.hull}%`}>🔧</span>}
          <button
            onClick={(e) => { e.stopPropagation(); focusUnit(unit.id); }}
            className="text-gray-500 hover:text-krt-accent text-xs"
            title="Focus on map"
          >
            🎯
          </button>
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

/** Group in the sidebar list */
function GroupListItem({ group, unitCount }) {
  const mission = MISSION_TYPES.find((m) => m.value === group.mission);

  return (
    <div className="p-3 rounded-lg bg-krt-bg/50 border border-transparent hover:border-krt-border">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
        <span className="text-sm font-medium">{group.name}</span>
        <span className="text-xs text-gray-500 ml-auto">{unitCount} units</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {mission?.label || group.mission}
      </div>
    </div>
  );
}

/** Status indicator badge */
function StatusBadge({ status }) {
  const colors = {
    idle: 'bg-gray-500',
    en_route: 'bg-blue-500',
    on_station: 'bg-green-500',
    engaged: 'bg-red-500',
    rtb: 'bg-yellow-500',
    disabled: 'bg-gray-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${colors[status] || 'bg-gray-500'}`}>
      {status}
    </span>
  );
}

/** Create unit form */
const MAP_SCALE = 1e6; // must match NavPointMarker
const SPAWNABLE_NAV_TYPES = ['station', 'rest_stop', 'outpost'];

function CreateUnitForm({ teamId, groups, onClose }) {
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

  // Available ships/vehicles for person assignment
  const availableShips = units.filter((u) => (u.unit_type === 'ship' || u.unit_type === 'ground_vehicle') && u.team_id === teamId);

  // Spawnable locations sorted alphabetically
  const spawnLocations = (navData?.points || [])
    .filter((p) => SPAWNABLE_NAV_TYPES.includes(p.nav_type) && p.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));

  const UNIT_TYPES = [
    { value: 'ship', label: '🚀 Ship' },
    { value: 'ground_vehicle', label: '🚗 Ground Vehicle' },
    { value: 'person', label: '🧑 Person' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // For persons aboard a ship, use the ship's position; otherwise require a station
    let spawnX = 0, spawnY = 0, spawnZ = 0;
    if (unitType === 'person' && parentUnitId) {
      const parentShip = units.find((u) => u.id === parentUnitId);
      if (parentShip) {
        spawnX = parentShip.pos_x || 0;
        spawnY = parentShip.pos_y || 0;
        spawnZ = parentShip.pos_z || 0;
      }
    } else {
      if (!stationId) {
        setError('Please select a starting location');
        return;
      }
      const station = spawnLocations.find((p) => p.id === stationId);
      spawnX = station ? (station.pos_x || 0) / MAP_SCALE : 0;
      spawnY = station ? (station.pos_y || 0) / MAP_SCALE : 0;
      spawnZ = station ? (station.pos_z || 0) / MAP_SCALE : 0;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          callsign: callsign || null,
          ship_type: shipType || null,
          unit_type: unitType,
          team_id: teamId,
          group_id: groupId || null,
          parent_unit_id: parentUnitId || null,
          role: role || null,
          crew_count: crewCount,
          crew_max: crewMax ? parseInt(crewMax) : null,
          pos_x: spawnX,
          pos_y: spawnY,
          pos_z: spawnZ,
        }),
      });

      if (res.ok) {
        toast.success('Unit created');
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        const msg = data?.details?.map(d => d.message).join(', ') || data?.error || `Error ${res.status}`;
        setError(msg);
        toast.error(`Failed: ${msg}`);
      }
    } catch (err) {
      setError('Network error — are you online?');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Unit name *"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
          autoFocus
        />
        <input
          type="text"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          placeholder="VHF-Freq (e.g. 148.500)"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={unitType}
          onChange={(e) => setUnitType(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          {UNIT_TYPES.map((ut) => (
            <option key={ut.value} value={ut.value}>{ut.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={shipType}
          onChange={(e) => setShipType(e.target.value)}
          placeholder="Ship type (e.g. Carrack)"
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
        />
      </div>
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role (e.g. Fighter escort, Medical)"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
      />
      <select
        value={stationId}
        onChange={(e) => setStationId(e.target.value)}
        className={`w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent ${unitType === 'person' && parentUnitId ? 'opacity-50' : ''}`}
        disabled={unitType === 'person' && !!parentUnitId}
      >
        <option value="">{unitType === 'person' && parentUnitId ? 'Position inherited from ship' : 'Starting location *'}</option>
        {spawnLocations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name} ({loc.nav_type.replace('_', ' ')})
          </option>
        ))}
      </select>
      {/* Parent ship selector for persons */}
      {unitType === 'person' && (
        <select
          value={parentUnitId}
          onChange={(e) => { setParentUnitId(e.target.value); if (e.target.value) setStationId(''); }}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          <option value="">Aboard ship (optional)</option>
          {availableShips.map((s) => (
            <option key={s.id} value={s.id}>
              {s.callsign ? `[${s.callsign}] ` : ''}{s.name} ({s.ship_type || s.unit_type})
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          <option value="">No group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          <input
            type="number"
            value={crewCount}
            onChange={(e) => setCrewCount(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="Crew"
            min={0}
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={crewMax}
            onChange={(e) => setCrewMax(e.target.value)}
            placeholder="Max"
            min={0}
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Create group form */
function CreateGroupForm({ teamId, onClose }) {
  const [name, setName] = useState('');
  const [mission, setMission] = useState('CUSTOM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const mType = MISSION_TYPES.find((m) => m.value === mission);
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          team_id: teamId,
          mission,
          color: mType?.color || '#3b82f6',
        }),
      });

      if (res.ok) {
        toast.success('Group created');
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        const msg = data?.details?.map(d => d.message).join(', ') || data?.error || `Error ${res.status}`;
        setError(msg);
        toast.error(`Failed: ${msg}`);
      }
    } catch (err) {
      setError('Network error — are you online?');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
        autoFocus
      />
      <select
        value={mission}
        onChange={(e) => setMission(e.target.value)}
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-krt-accent"
      >
        {MISSION_TYPES.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Batch status update for selected units */
function BatchStatusUpdate({ unitIds, teamId }) {
  const handleStatusChange = async (newStatus) => {
    try {
      for (const id of unitIds) {
        const res = await fetch(`/api/units/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
          const updated = await res.json();
          useMissionStore.getState().updateUnit(updated);
        }
      }
      toast.success(`${unitIds.length} unit(s) → ${newStatus}`);
    } catch {
      toast.error('Failed to update some units');
    }
  };

  return (
    <div className="p-2 bg-krt-bg/50 rounded-lg">
      <p className="text-xs text-gray-400 mb-2">Set status for {unitIds.length} unit(s):</p>
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className="text-xs px-2 py-1 rounded bg-krt-panel border border-krt-border hover:border-krt-accent transition-colors"
          >
            {status}
          </button>
        ))}
      </div>
    </div>
  );
}

/** IFF color map */
const IFF_COLORS = {
  friendly: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' },
  hostile: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' },
  neutral: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  unknown: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' },
};

/** Contact list item */
function ContactListItem({ contact, inactive }) {
  const handleDeactivate = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !contact.is_active }),
      });
      if (res.ok) {
        const updated = await res.json();
        useMissionStore.getState().updateContact(updated);
      }
    } catch {
      toast.error('Failed to update contact');
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        useMissionStore.getState().removeContact(contact.id);
        toast.success('Contact deleted');
      }
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const colors = IFF_COLORS[contact.iff] || IFF_COLORS.unknown;

  return (
    <div className={`p-3 rounded-lg border ${inactive ? 'opacity-50' : ''} ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <span className={`text-xs font-bold uppercase ${colors.text}`}>{contact.iff}</span>
          {contact.threat !== 'none' && (
            <span className="text-xs text-red-400">⚠{contact.threat}</span>
          )}
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
      <div className="text-sm text-white mt-0.5">
        {contact.name || 'Unknown'} {contact.count > 1 && `×${contact.count}`}
      </div>
      <div className="text-xs text-gray-500">
        {contact.ship_type || 'Unknown ship'} • ({contact.pos_x?.toFixed(0)}, {contact.pos_y?.toFixed(0)}, {contact.pos_z?.toFixed(0)})
      </div>
      {contact.notes && (
        <div className="text-xs text-gray-400 mt-1 italic">{contact.notes}</div>
      )}
    </div>
  );
}

/** Priority color map */
const PRIORITY_COLORS_MAP = {
  low: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', badge: 'bg-gray-600' },
  normal: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', badge: 'bg-blue-600' },
  high: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', badge: 'bg-yellow-600' },
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', badge: 'bg-red-600' },
};

const TASK_STATUS_OPTIONS = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

/** Task list item */
function TaskListItem({ task, completed }) {
  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        useMissionStore.getState().updateTask(updated);
        toast.success(`Task → ${newStatus}`);
      }
    } catch {
      toast.error('Failed to update task');
    }
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
      {task.description && (
        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{task.description}</div>
      )}
      {(task.assigned_unit_name || task.assigned_group_name) && (
        <div className="text-xs text-gray-500 mt-1">
          → {task.assigned_unit_name || task.assigned_group_name}
        </div>
      )}
      {!completed && (
        <div className="flex gap-1 mt-2">
          {TASK_STATUS_OPTIONS.filter(s => s !== task.status).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className="text-xs px-1.5 py-0.5 rounded bg-krt-panel border border-krt-border hover:border-krt-accent transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
