import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { useAuthStore } from '../stores/authStore';

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
  const { teamId, units, groups, selectedUnitIds, clearSelection } = useMissionStore();
  const [tab, setTab] = useState('units');
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const selectedUnits = units.filter((u) => selectedUnitIds.includes(u.id));

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
        <span className="text-xs text-gray-500">{user?.username}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-krt-border">
        {['units', 'groups', 'selected'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'text-krt-accent border-b-2 border-krt-accent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'units' && `Units (${units.length})`}
            {t === 'groups' && `Groups (${groups.length})`}
            {t === 'selected' && `Selected (${selectedUnitIds.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Units tab */}
        {tab === 'units' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowCreateUnit(!showCreateUnit)}
              className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
            >
              + Add Unit
            </button>

            {showCreateUnit && (
              <CreateUnitForm
                teamId={teamId}
                groups={groups}
                onClose={() => setShowCreateUnit(false)}
              />
            )}

            {units.map((unit) => {
              const group = groups.find((g) => g.id === unit.group_id);
              return (
                <UnitListItem
                  key={unit.id}
                  unit={unit}
                  group={group}
                  isSelected={selectedUnitIds.includes(unit.id)}
                />
              );
            })}
          </div>
        )}

        {/* Groups tab */}
        {tab === 'groups' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowCreateGroup(!showCreateGroup)}
              className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
            >
              + Add Group
            </button>

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
                {selectedUnits.map((unit) => (
                  <UnitListItem key={unit.id} unit={unit} isSelected />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Single unit in the sidebar list */
function UnitListItem({ unit, group, isSelected }) {
  const { toggleSelectUnit } = useMissionStore();

  return (
    <div
      onClick={() => toggleSelectUnit(unit.id)}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-krt-accent/10 border border-krt-accent/30'
          : 'bg-krt-bg/50 border border-transparent hover:border-krt-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{unit.name}</span>
        <StatusBadge status={unit.status} />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {unit.ship_type || 'Unknown ship'} {group && `• ${group.name}`}
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
function CreateUnitForm({ teamId, groups, onClose }) {
  const [name, setName] = useState('');
  const [shipType, setShipType] = useState('');
  const [groupId, setGroupId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const res = await fetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: name.trim(),
        ship_type: shipType || null,
        team_id: teamId,
        group_id: groupId || null,
      }),
    });

    if (res.ok) {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Unit name"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
        autoFocus
      />
      <input
        type="text"
        value={shipType}
        onChange={(e) => setShipType(e.target.value)}
        placeholder="Ship type (e.g. Carrack)"
        className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
      />
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
      <div className="flex gap-2">
        <button type="submit" className="bg-krt-accent text-white text-sm px-3 py-1 rounded">
          Create
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

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
      onClose();
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
      <div className="flex gap-2">
        <button type="submit" className="bg-krt-accent text-white text-sm px-3 py-1 rounded">
          Create
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
    for (const id of unitIds) {
      await fetch(`/api/units/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
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
