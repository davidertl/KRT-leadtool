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
  { value: 'move', label: '🚀 Move' },
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
  { value: 'aggressive', label: 'AGGRESSIVE', color: '#dc2626' },
  { value: 'fire_at_will', label: 'FIRE AT WILL', color: '#ef4444' },
  { value: 'fire_at_id_target', label: 'FIRE AT ID TARGET', color: '#f59e0b' },
  { value: 'self_defence', label: 'SELF DEFENCE', color: '#22c55e' },
  { value: 'dnf', label: 'DO NOT FIRE', color: '#9ca3af' },
];

/**
 * Create / Edit task form
 * Pass `task` prop for edit mode, omit for create mode.
 */
export default function TaskForm({ missionId, onClose, task: editTask }) {
  const isEdit = !!editTask;
  const { units, groups, contacts, tasks, operationPhases, operations, navData } = useMissionStore();
  const [title, setTitle] = useState(editTask?.title || '');
  const [description, setDescription] = useState(editTask?.description || '');
  const [taskType, setTaskType] = useState(editTask?.task_type || 'custom');
  const [priority, setPriority] = useState(editTask?.priority || 'normal');
  const [roe, setRoe] = useState(editTask?.roe || 'self_defence');
  const [assignedTo, setAssignedTo] = useState(editTask?.assigned_to || '');
  const [assignedGroup, setAssignedGroup] = useState(editTask?.assigned_group || '');
  const [targetContact, setTargetContact] = useState(editTask?.target_contact || '');
  const [targetX, setTargetX] = useState(editTask?.target_x != null ? String(editTask.target_x) : '');
  const [targetY, setTargetY] = useState(editTask?.target_y != null ? String(editTask.target_y) : '');
  const [targetZ, setTargetZ] = useState(editTask?.target_z != null ? String(editTask.target_z) : '');
  const [startAt, setStartAt] = useState(editTask?.start_at ? editTask.start_at.slice(0, 16) : '');
  const [dueAt, setDueAt] = useState(editTask?.due_at ? editTask.due_at.slice(0, 16) : '');
  const [dependsOn, setDependsOn] = useState(editTask?.depends_on || '');
  const [startNow, setStartNow] = useState(isEdit ? false : true);
  const [phaseId, setPhaseId] = useState(editTask?.phase_id || '');
  const [targetNavPoint, setTargetNavPoint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // When a contact is selected, auto-fill position
  const handleContactChange = (contactId) => {
    setTargetContact(contactId);
    if (contactId) {
      const c = contacts.find((con) => con.id === contactId);
      if (c) {
        setTargetX(c.pos_x?.toString() || '');
        setTargetY(c.pos_y?.toString() || '');
        setTargetZ(c.pos_z?.toString() || '');
        setTargetNavPoint('');
      }
    }
  };

  // When a nav point is selected, auto-fill position
  const handleNavPointChange = (navPointId) => {
    setTargetNavPoint(navPointId);
    if (navPointId) {
      const np = (navData?.points || []).find((p) => p.id === navPointId);
      if (np) {
        setTargetX(np.pos_x?.toString() || '');
        setTargetY(np.pos_y?.toString() || '');
        setTargetZ(np.pos_z?.toString() || '');
        setTargetContact('');
      }
    }
  };

  // Auto-fill target position from source contact
  const fillFromContact = () => {
    if (targetContact) {
      const c = contacts.find((con) => con.id === targetContact);
      if (c) {
        setTargetX(c.pos_x?.toString() || '');
        setTargetY(c.pos_y?.toString() || '');
        setTargetZ(c.pos_z?.toString() || '');
      }
    }
  };

  // Active operation phases for phase picker
  const activeOp = operations.find((o) => o.phase !== 'complete');
  const phases = activeOp ? operationPhases.filter((p) => p.operation_id === activeOp.id).sort((a, b) => a.sort_order - b.sort_order) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    try {
      const payload = {
        ...(isEdit ? {} : { mission_id: missionId }),
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
        start_at: startNow ? new Date().toISOString() : (startAt ? new Date(startAt).toISOString() : null),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        depends_on: dependsOn || null,
        phase_id: phaseId || null,
      };

      const url = isEdit ? `/api/tasks/${editTask.id}` : '/api/tasks';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      if (isEdit) {
        const updated = await res.json();
        useMissionStore.getState().updateTask(updated);
        toast.success('Task updated');
      } else {
        toast.success('Task created');
      }
      onClose();
    } catch (err) {
      toast.error(isEdit ? `Failed to update task: ${err.message}` : `Failed to create task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const activeContacts = contacts.filter((c) => c.is_active);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold text-white">{isEdit ? '✏️ Edit Task' : '📋 New Task / Order'}</h4>

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
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={startNow} onChange={(e) => { setStartNow(e.target.checked); if (e.target.checked) setStartAt(''); }} className="rounded" />
          Start Now
        </label>
        {!startNow && (
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
        )}
      </div>

      {/* Phase Picker (if operation running) */}
      {phases.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Operation Phase</label>
          <select
            value={phaseId}
            onChange={(e) => setPhaseId(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— No Phase —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

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
            onChange={(e) => handleContactChange(e.target.value)}
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
        <label className="text-xs text-gray-500 block mb-1">Target Position</label>

        {/* Nav point selector */}
        {(navData?.points || []).length > 0 && (
          <select
            value={targetNavPoint}
            onChange={(e) => handleNavPointChange(e.target.value)}
            className="w-full mb-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— Select Nav Point —</option>
            {(navData?.points || [])
              .filter((p) => p.nav_type !== 'om')
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>📍 {p.name} ({p.nav_type})</option>
              ))}
          </select>
        )}

        {/* Auto-fill from source contact */}
        {targetContact && (
          <button
            type="button"
            onClick={fillFromContact}
            className="text-[10px] text-krt-accent hover:text-blue-400 mb-1"
          >
            📡 Fill position from target contact
          </button>
        )}

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
          {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Task' : 'Create Task')}
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}
