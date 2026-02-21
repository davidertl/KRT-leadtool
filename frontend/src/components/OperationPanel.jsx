import React, { useState, useEffect, useRef } from 'react';
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
 * Operation panel — create/manage operations with phase management and timer
 */
export default function OperationPanel({ missionId }) {
  const { operations } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const activeOp = operations.find((o) => o.phase !== 'complete');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_id: missionId, name: newName.trim(), description: newDesc || null }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Operation created');
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch {
      toast.error('Failed to create operation');
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
          <div className="flex gap-2">
            <button type="submit" className="bg-krt-accent text-white text-sm px-3 py-1 rounded">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
          </div>
        </form>
      )}

      {activeOp && <ActiveOperation op={activeOp} />}

      {/* Past operations */}
      {operations.filter((o) => o.phase === 'complete').length > 0 && (
        <div className="pt-2 border-t border-krt-border">
          <p className="text-xs text-gray-600 mb-1">
            Past ({operations.filter((o) => o.phase === 'complete').length})
          </p>
          {operations.filter((o) => o.phase === 'complete').map((op) => (
            <div key={op.id} className="p-2 rounded bg-krt-bg/30 text-xs text-gray-500 mb-1">
              <span className="text-gray-300">{op.name}</span>
              {op.ended_at && <span className="ml-2">{new Date(op.ended_at).toLocaleDateString()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveOperation({ op }) {
  const [timer, setTimer] = useState(op.timer_seconds || 0);
  const timerRef = useRef(null);
  const currentPhase = PHASES.find((p) => p.value === op.phase);
  const currentRoe = ROE_OPTIONS.find((r) => r.value === op.roe);
  const phaseIdx = PHASES.findIndex((p) => p.value === op.phase);

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

  return (
    <div className="space-y-3">
      {/* Op name & phase */}
      <div className="p-3 rounded-lg border" style={{ borderColor: currentPhase?.color + '60', backgroundColor: currentPhase?.color + '10' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-bold text-sm">{op.name}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: currentPhase?.color + '33', color: currentPhase?.color }}>
            {currentPhase?.label || op.phase}
          </span>
        </div>
        {op.description && (
          <p className="text-xs text-gray-400 mb-2">{op.description}</p>
        )}
        {op.started_at && (
          <p className="text-[10px] text-gray-600">
            Started: {new Date(op.started_at).toLocaleTimeString()}
          </p>
        )}
      </div>

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
          <button
            onClick={advancePhase}
            className="text-xs text-krt-accent hover:text-blue-400"
          >
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

      {/* ROE */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Rules of Engagement</label>
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
          } catch {
            toast.error('Failed');
          }
        }}
        className="text-xs text-red-500 hover:text-red-400"
      >
        Delete Operation
      </button>
    </div>
  );
}
