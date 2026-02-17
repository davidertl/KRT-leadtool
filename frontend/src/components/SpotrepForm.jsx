import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const IFF_OPTIONS = [
  { value: 'hostile', label: '🔴 Hostile', color: '#ef4444' },
  { value: 'neutral', label: '🟡 Neutral', color: '#f59e0b' },
  { value: 'unknown', label: '🟣 Unknown', color: '#a855f7' },
  { value: 'friendly', label: '🟢 Friendly', color: '#22c55e' },
];

const THREAT_OPTIONS = ['none', 'low', 'medium', 'high', 'critical'];

const CONFIDENCE_OPTIONS = [
  { value: 'unconfirmed', label: 'Unconfirmed', color: '#6b7280' },
  { value: 'hearsay', label: 'Hearsay', color: '#a855f7' },
  { value: 'comms', label: 'Comms Intel', color: '#f59e0b' },
  { value: 'visual', label: 'Visual', color: '#3b82f6' },
  { value: 'confirmed', label: 'Confirmed', color: '#22c55e' },
];

/**
 * SPOTREP contact report form
 */
export default function SpotrepForm({ teamId, onClose }) {
  const [iff, setIff] = useState('unknown');
  const [threat, setThreat] = useState('none');
  const [confidence, setConfidence] = useState('unconfirmed');
  const [name, setName] = useState('');
  const [shipType, setShipType] = useState('');
  const [count, setCount] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [velX, setVelX] = useState(0);
  const [velY, setVelY] = useState(0);
  const [velZ, setVelZ] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          team_id: teamId,
          iff,
          threat,
          confidence,
          name: name || null,
          ship_type: shipType || null,
          count,
          pos_x: posX,
          pos_y: posY,
          pos_z: posZ,
          vel_x: velX,
          vel_y: velY,
          vel_z: velZ,
          notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');
      toast.success('SPOTREP filed');
      onClose();
    } catch {
      toast.error('Failed to submit SPOTREP');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
        📡 SPOTREP — Contact Report
      </h4>

      {/* IFF Classification */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Classification (IFF)</label>
        <div className="grid grid-cols-2 gap-1">
          {IFF_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIff(opt.value)}
              className={`text-xs px-2 py-1.5 rounded transition-colors ${
                iff === opt.value
                  ? 'text-white border-2'
                  : 'bg-krt-bg text-gray-400 border border-krt-border hover:text-white'
              }`}
              style={iff === opt.value ? { backgroundColor: opt.color + '33', borderColor: opt.color } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Threat */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Threat Level</label>
        <div className="flex gap-1">
          {THREAT_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setThreat(t)}
              className={`text-xs px-2 py-1 rounded flex-1 transition-colors ${
                threat === t
                  ? 'bg-krt-accent text-white'
                  : 'bg-krt-bg text-gray-400 border border-krt-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Confidence</label>
        <div className="flex gap-1">
          {CONFIDENCE_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setConfidence(c.value)}
              className={`text-[10px] px-1.5 py-1 rounded flex-1 transition-colors ${
                confidence === c.value
                  ? 'text-white border-2'
                  : 'bg-krt-bg text-gray-400 border border-krt-border'
              }`}
              style={confidence === c.value ? { backgroundColor: c.color + '33', borderColor: c.color } : {}}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Identification */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Callsign / Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Unknown"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Ship Type</label>
          <input
            type="text"
            value={shipType}
            onChange={(e) => setShipType(e.target.value)}
            placeholder="Unknown"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>

      {/* Count */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Count</label>
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
          min={1}
          className="w-20 bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
        />
      </div>

      {/* Position */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Last Known Position</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            value={posX}
            onChange={(e) => setPosX(parseFloat(e.target.value) || 0)}
            placeholder="X"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={posY}
            onChange={(e) => setPosY(parseFloat(e.target.value) || 0)}
            placeholder="Y"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={posZ}
            onChange={(e) => setPosZ(parseFloat(e.target.value) || 0)}
            placeholder="Z"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>

      {/* Movement Vector (optional) */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Movement Vector (optional)</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            value={velX}
            onChange={(e) => setVelX(parseFloat(e.target.value) || 0)}
            placeholder="Vel X"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={velY}
            onChange={(e) => setVelY(parseFloat(e.target.value) || 0)}
            placeholder="Vel Y"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
          <input
            type="number"
            value={velZ}
            onChange={(e) => setVelZ(parseFloat(e.target.value) || 0)}
            placeholder="Vel Z"
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Activity, weapons, behavior…"
          className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-krt-accent text-white text-sm px-4 py-1.5 rounded disabled:opacity-50"
        >
          {submitting ? 'Filing…' : 'File SPOTREP'}
        </button>
        <button type="button" onClick={onClose} className="text-gray-400 text-sm px-3 py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}
