import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
];

const TASK_TYPES = [
  { value: 'custom', label: '📝 Custom' },
  { value: 'escort', label: '🛡️ Escort' },
  { value: 'intercept', label: '⚔️ Intercept' },
  { value: 'recon', label: '👁️ Recon' },
  { value: 'patrol', label: '🔄 Patrol' },
  { value: 'hold', label: '✋ Hold Position' },
  { value: 'pickup', label: '📥 Pickup' },
  { value: 'dropoff', label: '📤 Drop-off' },
  { value: 'screen', label: '🔲 Screen' },
  { value: 'qrf', label: '🚀 QRF' },
  { value: 'rescue', label: '🚑 Rescue' },
  { value: 'repair', label: '🔧 Repair' },
  { value: 'refuel', label: '⛽ Refuel' },
  { value: 'medevac', label: '🏥 MedEvac' },
  { value: 'supply_run', label: '📦 Supply Run' },
];

const ROE_OPTIONS = [
  { value: 'weapons_free', label: 'WEAPONS FREE', color: '#ef4444' },
  { value: 'weapons_tight', label: 'WEAPONS TIGHT', color: '#f59e0b' },
  { value: 'weapons_hold', label: 'WEAPONS HOLD', color: '#22c55e' },
  { value: 'defensive', label: 'DEFENSIVE', color: '#3b82f6' },
  { value: 'aggressive', label: 'AGGRESSIVE', color: '#dc2626' },
  { value: 'no_fire', label: 'NO FIRE', color: '#9ca3af' },
];

/**
 * Create new task / order form
 */
export default function TaskForm({ teamId, onClose }) {
  const { units, groups, contacts, tasks } = useMissionStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('custom');
  const [priority, setPriority] = useState('normal');
  const [roe, setRoe] = useState('weapons_tight');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('');
  const [targetContact, setTargetContact] = useState('');
  const [targetX, setTargetX] = useState('');
  const [targetY, setTargetY] = useState('');
  const [targetZ, setTargetZ] = useState('');
  const [startAt, setStartAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [dependsOn, setDependsOn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    try {
      const payload = {
        team_id: teamId,
        title: title.trim(),
        description: description || null,
        task_type: taskType,
        priority,
        roe,
        assigned_to: assignedTo || null,
        assigned_group: assignedGroup || null,
        target_contact: targetContact || null,
        target_x: targetX !== '' ? parseFloat(targetX) : null,
        target_y: targetY !== '' ? parseFloat(targetY) : null,
        target_z: targetZ !== '' ? parseFloat(targetZ) : null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        depends_on: dependsOn || null,
      };

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to create task');
      toast.success('Task created');
      onClose();
    } catch {
      toast.error('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const activeContacts = contacts.filter((c) => c.is_active);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold text-white">📋 New Task / Order</h4>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
        autoFocus
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description / orders…"
        className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent resize-none"
      />

      {/* Task Type */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Task Type</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Priority & ROE */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Priority</label>
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`text-[10px] px-1.5 py-1 rounded flex-1 transition-colors ${
                  priority === p.value
                    ? 'text-white border-2'
                    : 'bg-krt-bg text-gray-400 border border-krt-border'
                }`}
                style={priority === p.value ? { backgroundColor: p.color + '33', borderColor: p.color } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">ROE</label>
          <select
            value={roe}
            onChange={(e) => setRoe(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            {ROE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scheduling */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Start At</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Due At</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>

      {/* Dependency */}
      {tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Depends On</label>
          <select
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— None —</option>
            {tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Assignment */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Assign to Unit</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— None —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Assign to Group</label>
          <select
            value={assignedGroup}
            onChange={(e) => setAssignedGroup(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— None —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Target contact */}
      {activeContacts.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Target Contact</label>
          <select
            value={targetContact}
            onChange={(e) => setTargetContact(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— None —</option>
            {activeContacts.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.iff.toUpperCase()}] {c.name || c.ship_type || 'Unknown'} ×{c.count}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Target position */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Target Position (optional)</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            value={targetX}
            onChange={(e) => setTargetX(e.target.value)}
            placeholder="X"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={targetY}
            onChange={(e) => setTargetY(e.target.value)}
            placeholder="Y"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={targetZ}
            onChange={(e) => setTargetZ(e.target.value)}
            placeholder="Z"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="bg-krt-accent text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Task'}
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}
