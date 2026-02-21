import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const MSG_BUTTONS = [
  { type: 'checkin', label: '✅ Check In', color: '#22c55e' },
  { type: 'checkout', label: '🚪 Check Out', color: '#f59e0b' },
  { type: 'rtb', label: '🔙 RTB', color: '#3b82f6' },
  { type: 'bingo', label: '⛽ BINGO', color: '#ef4444', desc: 'Low fuel' },
  { type: 'winchester', label: '💨 WINCHESTER', color: '#dc2626', desc: 'No ammo' },
  { type: 'hold', label: '✋ HOLD', color: '#f97316' },
  { type: 'contact', label: '📡 Contact', color: '#a855f7' },
  { type: 'status', label: '📊 Status', color: '#06b6d4' },
];

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Quick messages / check-in panel — one-click military comms
 */
export default function QuickMessages({ missionId }) {
  const { messages, units } = useMissionStore();
  const [selectedUnit, setSelectedUnit] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async (msgType, message) => {
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mission_id: missionId,
          unit_id: selectedUnit || null,
          message_type: msgType,
          message: message || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`${msgType.toUpperCase()} sent`);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Unit selector */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Reporting Unit (optional)</label>
        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          <option value="">— General —</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
          ))}
        </select>
      </div>

      {/* Quick buttons */}
      <div className="grid grid-cols-2 gap-1">
        {MSG_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            onClick={() => sendMessage(btn.type)}
            disabled={sending}
            className="text-xs px-2 py-2 rounded border border-krt-border hover:border-opacity-100 transition-colors text-left disabled:opacity-50"
            style={{ borderColor: btn.color + '40', color: btn.color }}
            title={btn.desc}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Custom message */}
      <div className="flex gap-1">
        <input
          type="text"
          value={customMsg}
          onChange={(e) => setCustomMsg(e.target.value)}
          placeholder="Custom message…"
          className="flex-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customMsg.trim()) {
              sendMessage('custom', customMsg.trim());
              setCustomMsg('');
            }
          }}
        />
        <button
          onClick={() => {
            if (customMsg.trim()) {
              sendMessage('custom', customMsg.trim());
              setCustomMsg('');
            }
          }}
          disabled={!customMsg.trim() || sending}
          className="bg-krt-accent text-white text-sm px-3 py-1 rounded disabled:opacity-50"
        >
          Send
        </button>
      </div>

      {/* Message feed */}
      <div className="border-t border-krt-border pt-2">
        <label className="text-xs text-gray-500 block mb-1">Recent Messages</label>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-2">No messages yet</p>
          )}
          {messages.map((msg) => {
            const btn = MSG_BUTTONS.find((b) => b.type === msg.message_type);
            return (
              <div key={msg.id} className="flex items-start gap-2 text-xs p-1.5 rounded bg-krt-bg/30">
                <span style={{ color: btn?.color || '#9ca3af' }}>
                  {msg.message_type === 'custom' ? '💬' : (btn?.label?.split(' ')[0] || '📝')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-300 font-medium">{msg.user_name || 'Unknown'}</span>
                    {msg.unit_name && <span className="text-gray-600">({msg.unit_name})</span>}
                    <span className="text-gray-700 ml-auto whitespace-nowrap">{timeAgo(msg.created_at)}</span>
                  </div>
                  <span className="text-gray-400">
                    {msg.message || msg.message_type.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
