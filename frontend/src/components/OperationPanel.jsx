import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const PHASES = [
  { value: 'planning', label: '📋 Planning', color: '#6b7280' },
  { value: 'briefing', label: '📡 Briefing', color: '#3b82f6' },
  { value: 'phase_1', label: '⚡ Phase 1', color: '#f59e0b' },
  { value: 'phase_2', label: '⚡ Phase 2', color: '#f59e0b' },
  { value: 'phase_3', label: '⚡ Phase 3', color: '#f59e0b' },
  { value: 'phase_4', label: '⚡ Phase 4', color: '#f59e0b' },
  { value: 'extraction', label: '🚁 Extraction', color: '#ef4444' },
  { value: 'debrief', label: '📝 Debrief', color: '#8b5cf6' },
  { value: 'complete', label: '✅ Complete', color: '#22c55e' },
];

const ROE_OPTIONS = [
  { value: 'aggressive', label: 'AGGRESSIVE', color: '#dc2626', desc: 'Engage all contacts' },
  { value: 'fire_at_will', label: 'FIRE AT WILL', color: '#ef4444', desc: 'Fire at will' },
  { value: 'fire_at_id_target', label: 'FIRE AT ID TARGET', color: '#f59e0b', desc: 'Fire on identified targets' },
  { value: 'self_defence', label: 'SELF DEFENCE', color: '#22c55e', desc: 'Fire only in self-defense' },
  { value: 'dnf', label: 'DO NOT FIRE', color: '#9ca3af', desc: 'Do not fire' },
];

function formatTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Operation panel — create/manage operations with phase management, ROE, and notes
 */
export default function OperationPanel({ missionId }) {
  const { operations } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [draftPhases, setDraftPhases] = useState([
    { name: 'Briefing', phase_type: 'custom', sort_order: 0 },
    { name: 'Phase 1', phase_type: 'custom', sort_order: 1 },
    { name: 'Phase 2', phase_type: 'custom', sort_order: 2 },
    { name: 'Extraction', phase_type: 'custom', sort_order: 3 },
    { name: 'Debrief', phase_type: 'custom', sort_order: 4 },
  ]);
  const [draftPhaseName, setDraftPhaseName] = useState('');
  const activeOp = operations.find((o) => o.phase !== 'complete');
  const [viewPastId, setViewPastId] = useState(null);

  const addDraftPhase = () => {
    if (!draftPhaseName.trim()) return;
    setDraftPhases((p) => [...p, { name: draftPhaseName.trim(), phase_type: 'custom', sort_order: p.length }]);
    setDraftPhaseName('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setShowCreate(false); // Close form immediately to prevent double-click
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_id: missionId, name: newName.trim(), description: newDesc || null }),
      });
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();

      // Create draft phases in bulk
      for (const dp of draftPhases) {
        await fetch('/api/operation-phases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ operation_id: created.id, ...dp }),
        });
      }

      toast.success('Operation created');
      setNewName('');
      setNewDesc('');
      setDraftPhases([
        { name: 'Briefing', phase_type: 'custom', sort_order: 0 },
        { name: 'Phase 1', phase_type: 'custom', sort_order: 1 },
        { name: 'Phase 2', phase_type: 'custom', sort_order: 2 },
        { name: 'Extraction', phase_type: 'custom', sort_order: 3 },
        { name: 'Debrief', phase_type: 'custom', sort_order: 4 },
      ]);
    } catch {
      toast.error('Failed to create operation');
      setShowCreate(true); // Reopen form on error so user can retry
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {!activeOp && !showCreate && (
        <>
          <p className="text-gray-500 text-sm text-center py-2">No active operation</p>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
          >
            + Start New Operation
          </button>
        </>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
          <h4 className="text-sm font-bold text-white">🎯 New Operation</h4>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Operation name"
            className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
            autoFocus
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description / objectives"
            rows={2}
            className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent resize-none"
          />

          {/* Inline phase editor during creation */}
          <div className="border border-krt-border rounded p-2 space-y-1">
            <label className="text-xs text-gray-500">Phases (optional)</label>
            {draftPhases.map((dp, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className="text-gray-400 w-5">{i + 1}.</span>
                <span className="text-white flex-1">{dp.name}</span>
                <button
                  type="button"
                  onClick={() => setDraftPhases((p) => p.filter((_, idx) => idx !== i))}
                  className="text-red-500 text-[10px] hover:text-red-400"
                >✕</button>
              </div>
            ))}
            <div className="flex gap-1">
              <input
                type="text"
                value={draftPhaseName}
                onChange={(e) => setDraftPhaseName(e.target.value)}
                placeholder="Phase name…"
                className="flex-1 bg-krt-panel border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftPhase(); } }}
              />
              <button type="button" onClick={addDraftPhase} className="text-krt-accent text-xs px-2">+ Add</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={creating || !newName.trim()} className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); }} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
          </div>
        </form>
      )}

      {activeOp && <ActiveOperation op={activeOp} missionId={missionId} />}

      {/* Past operations — debrief access */}
      {operations.filter((o) => o.phase === 'complete').length > 0 && (
        <div className="pt-2 border-t border-krt-border">
          <p className="text-xs text-gray-500 font-bold mb-1">
            📋 Past Operations ({operations.filter((o) => o.phase === 'complete').length})
          </p>
          {operations.filter((o) => o.phase === 'complete').map((op) => (
            <div key={op.id} className="mb-2">
              <div
                className="p-2 rounded bg-krt-bg/50 border border-krt-border cursor-pointer hover:border-krt-accent/40 transition-colors"
                onClick={() => setViewPastId(viewPastId === op.id ? null : op.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 font-medium">{op.name}</span>
                  <div className="flex items-center gap-2">
                    {op.ended_at && <span className="text-[10px] text-gray-600">{new Date(op.ended_at).toLocaleDateString()}</span>}
                    <span className="text-xs text-gray-500">{viewPastId === op.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {op.description && <p className="text-[10px] text-gray-500 mt-0.5">{op.description}</p>}
              </div>
              {viewPastId === op.id && <PastOperationDebrief op={op} missionId={missionId} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Past Operation Debrief View ──────────────────────── */
function PastOperationDebrief({ op, missionId }) {
  const [phases, setPhases] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [ph, n] = await Promise.all([
          fetch(`/api/operation-phases?operation_id=${op.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
          fetch(`/api/operation-notes?operation_id=${op.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
        ]);
        setPhases(Array.isArray(ph) ? ph.sort((a, b) => a.sort_order - b.sort_order) : []);
        setNotes(Array.isArray(n) ? n : []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [op.id]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch('/api/operation-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation_id: op.id, content: newNote.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();
      setNotes((prev) => [...prev, created]);
      setNewNote('');
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
  };

  if (loading) return <p className="text-xs text-gray-500 p-2">Loading debrief…</p>;

  return (
    <div className="mt-1 p-3 rounded bg-krt-bg/30 border border-krt-border space-y-3">
      {/* Timeline */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Timeline</label>
        <div className="text-[10px] text-gray-400 space-y-0.5">
          {op.started_at && <div>▶ Started: {new Date(op.started_at).toLocaleString()}</div>}
          {op.ended_at && <div>⏹ Ended: {new Date(op.ended_at).toLocaleString()}</div>}
          {op.started_at && op.ended_at && (
            <div>⏱ Duration: {Math.round((new Date(op.ended_at) - new Date(op.started_at)) / 60000)} min</div>
          )}
        </div>
      </div>

      {/* Phases */}
      {phases.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Phases</label>
          <div className="space-y-1">
            {phases.map((ph, i) => (
              <div key={ph.id} className="text-xs flex items-center gap-2 text-gray-400">
                <span className="text-gray-600 w-4">{i + 1}.</span>
                <span className="text-gray-300">{ph.name}</span>
                {ph.actual_start && (
                  <span className="text-[10px] text-yellow-500">
                    {new Date(ph.actual_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {ph.actual_end && (
                  <span className="text-[10px] text-green-500">
                    → {new Date(ph.actual_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Debrief Notes ({notes.length})</label>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {notes.length === 0 && <p className="text-[10px] text-gray-600">No notes</p>}
          {notes.map((n) => (
            <div key={n.id} className="p-1.5 rounded bg-krt-bg/50 text-xs">
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <span>{n.created_by_name || 'Unknown'}</span>
                <span className="ml-auto">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-gray-400 whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>

        {/* Add post-mission note */}
        <div className="flex gap-1 mt-1">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add debrief note…"
            className="flex-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
            onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }}
          />
          <button onClick={addNote} disabled={!newNote.trim()} className="text-krt-accent text-xs px-2 disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  );
}

function ActiveOperation({ op, missionId }) {
  const { operationPhases, operationRoe, operationNotes, units, groups,
    setOperationPhases, setOperationRoe, setOperationNotes } = useMissionStore();
  const [timer, setTimer] = useState(op.timer_seconds || 0);
  const timerRef = useRef(null);
  const [tab, setTab] = useState('main'); // main | phases | roe | notes
  const currentPhase = PHASES.find((p) => p.value === op.phase);
  const phaseIdx = PHASES.findIndex((p) => p.value === op.phase);

  /* Fetch child data on mount */
  useEffect(() => {
    const load = async () => {
      try {
        const [ph, roe, notes] = await Promise.all([
          fetch(`/api/operation-phases?operation_id=${op.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
          fetch(`/api/operation-roe?operation_id=${op.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
          fetch(`/api/operation-notes?operation_id=${op.id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => []),
        ]);
        setOperationPhases(Array.isArray(ph) ? ph : []);
        setOperationRoe(Array.isArray(roe) ? roe : []);
        setOperationNotes(Array.isArray(notes) ? notes : []);
      } catch { /* ignore */ }
    };
    load();
  }, [op.id]);

  // Timer countdown
  useEffect(() => {
    if (op.timer_running && op.timer_started_at) {
      const elapsed = Math.floor((Date.now() - new Date(op.timer_started_at).getTime()) / 1000);
      const remaining = Math.max(0, (op.timer_seconds || 0) - elapsed);
      setTimer(remaining);

      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 0) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimer(op.timer_seconds || 0);
    }
    return () => clearInterval(timerRef.current);
  }, [op.timer_running, op.timer_started_at, op.timer_seconds]);

  const updateOp = async (data) => {
    try {
      const res = await fetch(`/api/operations/${op.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      toast.error('Failed to update operation');
    }
  };

  const advancePhase = () => {
    if (phaseIdx < PHASES.length - 1) {
      updateOp({ phase: PHASES[phaseIdx + 1].value });
    }
  };

  const setTimerMinutes = (min) => {
    updateOp({ timer_seconds: min * 60, timer_running: true });
  };

  const TABS = [
    { key: 'main', label: '⚙️ Main' },
    { key: 'phases', label: `📋 Phases (${operationPhases.length})` },
    { key: 'roe', label: '🎯 ROE' },
    { key: 'notes', label: `📝 Notes (${operationNotes.length})` },
  ];

  return (
    <div className="space-y-3">
      {/* Op name & phase header */}
      <div className="p-3 rounded-lg border" style={{ borderColor: currentPhase?.color + '60', backgroundColor: currentPhase?.color + '10' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-bold text-sm">{op.name}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: currentPhase?.color + '33', color: currentPhase?.color }}>
            {currentPhase?.label || op.phase}
          </span>
        </div>
        {op.description && <p className="text-xs text-gray-400 mb-2">{op.description}</p>}
        {op.started_at && (
          <p className="text-[10px] text-gray-600">Started: {new Date(op.started_at).toLocaleTimeString()}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-krt-border pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[10px] px-2 py-1 rounded-t transition-colors ${
              tab === t.key ? 'text-krt-accent border-b-2 border-krt-accent' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'main' && (
        <>
          {/* Phase progression */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Phase</label>
            <div className="flex gap-0.5 mb-2">
              {PHASES.map((p, i) => (
                <div
                  key={p.value}
                  className="h-1.5 flex-1 rounded-full cursor-pointer"
                  style={{ backgroundColor: i <= phaseIdx ? currentPhase?.color : '#1f2937' }}
                  onClick={() => updateOp({ phase: p.value })}
                  title={p.label}
                />
              ))}
            </div>
            {op.phase !== 'complete' && (
              <button onClick={advancePhase} className="text-xs text-krt-accent hover:text-blue-400">
                → Advance to {PHASES[phaseIdx + 1]?.label || 'next'}
              </button>
            )}
          </div>

          {/* Timer */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Phase Timer</label>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-mono font-bold ${timer <= 60 && op.timer_running ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {formatTimer(timer)}
              </span>
              <div className="flex flex-col gap-1 ml-auto">
                <div className="flex gap-1">
                  {[5, 10, 15, 30].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTimerMinutes(m)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-krt-bg border border-krt-border hover:border-krt-accent text-gray-400"
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateOp({ timer_running: !op.timer_running })}
                    className={`text-[10px] px-2 py-0.5 rounded ${op.timer_running ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                  >
                    {op.timer_running ? '⏸ Pause' : '▶ Start'}
                  </button>
                  <button
                    onClick={() => updateOp({ timer_seconds: 0, timer_running: false })}
                    className="text-[10px] px-2 py-0.5 rounded bg-krt-bg text-gray-500"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Global ROE */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Global ROE</label>
            <div className="grid grid-cols-2 gap-1">
              {ROE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => updateOp({ roe: r.value })}
                  className={`text-[10px] px-2 py-1.5 rounded transition-colors text-left ${
                    op.roe === r.value
                      ? 'text-white border-2'
                      : 'bg-krt-bg text-gray-400 border border-krt-border hover:text-white'
                  }`}
                  style={op.roe === r.value ? { backgroundColor: r.color + '20', borderColor: r.color } : {}}
                >
                  <div className="font-bold">{r.label}</div>
                  <div className="text-gray-500">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={async () => {
              if (!confirm('Delete this operation?')) return;
              try {
                await fetch(`/api/operations/${op.id}`, { method: 'DELETE', credentials: 'include' });
                toast.success('Operation deleted');
              } catch { toast.error('Failed'); }
            }}
            className="text-xs text-red-500 hover:text-red-400"
          >
            Delete Operation
          </button>
        </>
      )}

      {tab === 'phases' && <PhasesTab opId={op.id} phases={operationPhases} />}
      {tab === 'roe' && <EntityRoeTab opId={op.id} roe={operationRoe} units={units} groups={groups} globalRoe={op.roe} />}
      {tab === 'notes' && <NotesTab opId={op.id} notes={operationNotes} phases={operationPhases} />}
    </div>
  );
}

/* ─── Phases Tab ───────────────────────────────────────── */
function PhasesTab({ opId, phases }) {
  const [newName, setNewName] = useState('');
  const { addOperationPhase, updateOperationPhase, removeOperationPhase } = useMissionStore();

  const createPhase = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/operation-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation_id: opId, name: newName.trim(), phase_type: 'custom', sort_order: phases.length }),
      });
      if (!res.ok) throw new Error('Failed');
      setNewName('');
    } catch { toast.error('Failed to add phase'); }
  };

  const toggleStart = async (phase) => {
    const now = new Date().toISOString();
    const data = phase.actual_start ? { actual_start: null } : { actual_start: now };
    try {
      const res = await fetch(`/api/operation-phases/${phase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
    } catch { toast.error('Failed'); }
  };

  const toggleEnd = async (phase) => {
    const now = new Date().toISOString();
    const data = phase.actual_end ? { actual_end: null } : { actual_end: now };
    try {
      const res = await fetch(`/api/operation-phases/${phase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
    } catch { toast.error('Failed'); }
  };

  const deletePhase = async (id) => {
    try {
      await fetch(`/api/operation-phases/${id}`, { method: 'DELETE', credentials: 'include' });
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-2">
      {phases.length === 0 && <p className="text-xs text-gray-600 text-center py-2">No phases defined</p>}
      {phases.map((ph, i) => {
        const started = !!ph.actual_start;
        const ended = !!ph.actual_end;
        return (
          <div key={ph.id} className={`p-2 rounded border text-xs ${ended ? 'border-green-800/40 bg-green-900/10' : started ? 'border-yellow-700/40 bg-yellow-900/10' : 'border-krt-border bg-krt-bg/30'}`}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-gray-500 w-4">{i + 1}.</span>
              <span className="text-white font-medium flex-1">{ph.name}</span>
              <button onClick={() => deletePhase(ph.id)} className="text-red-600 text-[10px] hover:text-red-400">✕</button>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => toggleStart(ph)}
                className={`text-[10px] px-2 py-0.5 rounded ${started ? 'bg-yellow-500/20 text-yellow-400' : 'bg-krt-bg text-gray-500 hover:text-gray-300'}`}
              >
                {started ? `▶ ${new Date(ph.actual_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '▶ Start'}
              </button>
              <button
                onClick={() => toggleEnd(ph)}
                className={`text-[10px] px-2 py-0.5 rounded ${ended ? 'bg-green-500/20 text-green-400' : 'bg-krt-bg text-gray-500 hover:text-gray-300'}`}
              >
                {ended ? `⏹ ${new Date(ph.actual_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '⏹ End'}
              </button>
            </div>
          </div>
        );
      })}

      {/* Add new phase */}
      <div className="flex gap-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New phase name…"
          className="flex-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
          onKeyDown={(e) => { if (e.key === 'Enter') createPhase(); }}
        />
        <button onClick={createPhase} className="text-krt-accent text-xs px-2">+ Add</button>
      </div>
    </div>
  );
}

/* ─── Per-Entity ROE Tab ───────────────────────────────── */
function EntityRoeTab({ opId, roe: roeRaw, units, groups, globalRoe }) {
  const roe = Array.isArray(roeRaw) ? roeRaw : [];
  const setEntityRoe = async (targetType, targetId, roeValue) => {
    try {
      const res = await fetch('/api/operation-roe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation_id: opId, target_type: targetType, target_id: targetId, roe: roeValue }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch { toast.error('Failed to set ROE'); }
  };

  const removeRoe = async (id) => {
    try {
      await fetch(`/api/operation-roe/${id}`, { method: 'DELETE', credentials: 'include' });
    } catch { toast.error('Failed'); }
  };

  const globalOpt = ROE_OPTIONS.find((r) => r.value === globalRoe);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-600">
        Global: <span style={{ color: globalOpt?.color }}>{globalOpt?.label || 'N/A'}</span> — override per unit/group below
      </p>

      {/* Groups */}
      {groups.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Groups</label>
          {groups.map((g) => {
            const entry = roe.find((r) => r.target_type === 'group' && r.target_id === g.id);
            return (
              <div key={g.id} className="flex items-center gap-1 mb-1 text-xs">
                <span className="text-gray-300 flex-1 truncate">👥 {g.name}</span>
                <select
                  value={entry?.roe || ''}
                  onChange={(e) => {
                    if (e.target.value) setEntityRoe('group', g.id, e.target.value);
                    else if (entry) removeRoe(entry.id);
                  }}
                  className="bg-krt-bg border border-krt-border rounded px-1 py-0.5 text-[10px] text-white"
                >
                  <option value="">Global</option>
                  {ROE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Units */}
      {units.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Units</label>
          {units.map((u) => {
            const entry = roe.find((r) => r.target_type === 'unit' && r.target_id === u.id);
            const roeOpt = ROE_OPTIONS.find((r) => r.value === entry?.roe);
            return (
              <div key={u.id} className="flex items-center gap-1 mb-1 text-xs">
                <span className="text-gray-300 flex-1 truncate">🚀 {u.callsign || u.name}</span>
                <select
                  value={entry?.roe || ''}
                  onChange={(e) => {
                    if (e.target.value) setEntityRoe('unit', u.id, e.target.value);
                    else if (entry) removeRoe(entry.id);
                  }}
                  className="bg-krt-bg border border-krt-border rounded px-1 py-0.5 text-[10px] text-white"
                >
                  <option value="">Global</option>
                  {ROE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Notes / Debrief Tab ──────────────────────────────── */
function NotesTab({ opId, notes, phases }) {
  const [content, setContent] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const { addOperationNote, removeOperationNote } = useMissionStore();

  const createNote = async () => {
    if (!content.trim()) return;
    try {
      const res = await fetch('/api/operation-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation_id: opId, phase_id: phaseId || null, content: content.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setContent('');
    } catch { toast.error('Failed to add note'); }
  };

  const deleteNote = async (id) => {
    try {
      await fetch(`/api/operation-notes/${id}`, { method: 'DELETE', credentials: 'include' });
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-2">
      {/* Note list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {notes.length === 0 && <p className="text-xs text-gray-600 text-center py-2">No notes yet</p>}
        {notes.map((n) => {
          const ph = phases.find((p) => p.id === n.phase_id);
          return (
            <div key={n.id} className="p-2 rounded bg-krt-bg/30 border border-krt-border text-xs">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-gray-300 font-medium">{n.created_by_name || 'Unknown'}</span>
                {ph && <span className="text-krt-accent text-[10px]">({ph.name})</span>}
                <span className="text-gray-700 ml-auto text-[10px]">
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button onClick={() => deleteNote(n.id)} className="text-red-600 text-[10px] hover:text-red-400 ml-1">✕</button>
              </div>
              <p className="text-gray-400 whitespace-pre-wrap">{n.content}</p>
            </div>
          );
        })}
      </div>

      {/* Add note */}
      <div className="space-y-1">
        {phases.length > 0 && (
          <select
            value={phaseId}
            onChange={(e) => setPhaseId(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">General note</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note or debrief entry…"
            rows={2}
            className="flex-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent resize-none"
          />
          <button
            onClick={createNote}
            disabled={!content.trim()}
            className="bg-krt-accent text-white text-xs px-3 rounded disabled:opacity-50 self-end py-1"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
