import React, { useState, useEffect, useCallback } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  ALPHA: '#ef4444',
  BRAVO: '#f59e0b',
  CHARLIE: '#22c55e',
  DELTA: '#3b82f6',
};

function freqLabel(val) {
  if (!val) return '—';
  const n = parseFloat(val);
  return isNaN(n) ? String(val) : n.toFixed(3);
}

function TxBadge({ active }) {
  if (!active) return null;
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" title="Transmitting" />
  );
}

export default function RadioNetPanel({ missionId }) {
  const { radioTxEvents } = useMissionStore();
  const [netData, setNetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msgFreq, setMsgFreq] = useState('');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchNet = useCallback(async () => {
    if (!missionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/radio/net?mission_id=${missionId}`, { credentials: 'include' });
      if (res.ok) setNetData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [missionId]);

  useEffect(() => {
    fetchNet();
    const interval = setInterval(fetchNet, 8000);
    return () => clearInterval(interval);
  }, [fetchNet]);

  const handleTransmit = async (e) => {
    e.preventDefault();
    if (!msgFreq || !msgText.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/radio/transmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_id: missionId, freq_id: Number(msgFreq), message: msgText.trim() }),
      });
      if (!res.ok) throw new Error('Send failed');
      setMsgText('');
      toast.success(`Message sent on freq ${msgFreq}`);
    } catch {
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  // Live TX events from socket
  const activeTx = {};
  for (const ev of (radioTxEvents || [])) {
    if (ev.action === 'start') activeTx[ev.freqId] = ev;
  }

  // Build combined frequency list
  const allFreqs = [];
  if (netData) {
    for (const u of netData.unitFrequencies || []) {
      const key = String(u.vhf_frequency);
      let entry = allFreqs.find((f) => f.key === key);
      if (!entry) { entry = { key, label: freqLabel(u.vhf_frequency), type: 'unit', entities: [] }; allFreqs.push(entry); }
      entry.entities.push({ name: u.callsign || u.name, type: 'unit' });
    }
    for (const g of netData.groupChannels || []) {
      const key = String(g.vhf_channel);
      let entry = allFreqs.find((f) => f.key === key);
      if (!entry) { entry = { key, label: freqLabel(g.vhf_channel), type: 'group', entities: [] }; allFreqs.push(entry); }
      entry.entities.push({ name: g.name, type: 'group', color: g.color });
    }
    allFreqs.sort((a, b) => parseFloat(a.key) - parseFloat(b.key));
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {loading ? 'Refreshing…' : `${allFreqs.length} frequencies active`}
        </span>
        <button onClick={fetchNet} className="text-[10px] text-gray-500 hover:text-gray-300 px-1 py-0.5 rounded hover:bg-krt-border/30">
          ↻ Refresh
        </button>
      </div>

      {/* Frequency channels */}
      {allFreqs.length === 0 && !loading && (
        <p className="text-xs text-gray-600 text-center py-4">No frequencies assigned yet.<br />Assign VHF frequencies to units or groups.</p>
      )}

      <div className="space-y-2">
        {allFreqs.map((freq) => {
          const listeners = netData?.listenerCounts?.[Number(freq.key)];
          const isActive = !!activeTx[Number(freq.key)];
          const txUser = activeTx[Number(freq.key)]?.username;

          return (
            <div
              key={freq.key}
              className={`rounded-lg p-2 border transition-colors ${
                isActive
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-krt-bg/60 border-krt-border'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-krt-accent">
                    {freq.label} MHz
                  </span>
                  <TxBadge active={isActive} />
                  {isActive && (
                    <span className="text-[10px] text-red-400 font-medium">
                      ● {txUser} TX
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {listeners?.count > 0 && (
                    <span className="text-[10px] text-green-400" title={listeners.users?.join(', ')}>
                      {listeners.count} 🎧
                    </span>
                  )}
                </div>
              </div>

              {/* Entities on this frequency */}
              <div className="flex flex-wrap gap-1">
                {freq.entities.map((e, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={
                      e.type === 'group' && e.color
                        ? { backgroundColor: e.color + '25', color: e.color }
                        : { backgroundColor: '#374151', color: '#9ca3af' }
                    }
                  >
                    {e.type === 'group' ? '👥' : '🚀'} {e.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent TX log */}
      {(netData?.recentTx?.length > 0) && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Recent Activity</label>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {netData.recentTx.slice(0, 15).map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className={ev.action === 'start' ? 'text-red-400' : 'text-green-400'}>
                  {ev.action === 'start' ? '▶' : '■'}
                </span>
                <span className="font-mono text-gray-400">{freqLabel(ev.freq_id)}</span>
                <span>{ev.username}</span>
                <span className="ml-auto text-gray-700">
                  {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text message on frequency (lead only) */}
      <div className="border-t border-krt-border pt-3">
        <label className="text-xs text-gray-500 block mb-2">Text Broadcast</label>
        <form onSubmit={handleTransmit} className="space-y-2">
          <select
            value={msgFreq}
            onChange={(e) => setMsgFreq(e.target.value)}
            className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">— Select frequency —</option>
            {allFreqs.map((f) => (
              <option key={f.key} value={f.key}>{f.label} MHz</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Text message to broadcast…"
              className="flex-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
              maxLength={256}
            />
            <button
              type="submit"
              disabled={sending || !msgFreq || !msgText.trim()}
              className="text-xs px-3 py-1 rounded bg-krt-accent/20 text-krt-accent border border-krt-accent/40 hover:bg-krt-accent/30 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
