import React, { useState, useMemo } from 'react';
import { useMissionStore } from '../stores/missionStore';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

/* Status preset messages per Class_setup.md */
const MSG_BUTTONS = [
  { type: 'boarding', label: '🚢 Boarding', color: '#a855f7', desc: 'Boarding a ship/vehicle' },
  { type: 'ready_for_takeoff', label: '✅ Ready for Takeoff', color: '#22c55e', desc: 'Standby / no active task' },
  { type: 'on_the_way', label: '🚀 On the Way', color: '#3b82f6', desc: 'Moving to destination' },
  { type: 'arrived', label: '📍 Arrived', color: '#06b6d4', desc: 'Arrived at assigned position' },
  { type: 'ready_for_orders', label: '🎯 Ready for Orders', color: '#10b981', desc: 'Awaiting new orders' },
  { type: 'in_combat', label: '⚔️ In Combat', color: '#ef4444', desc: 'In combat / active operation' },
  { type: 'heading_home', label: '🔙 Heading Home', color: '#f59e0b', desc: 'Returning to base' },
  { type: 'damaged', label: '💥 Damaged', color: '#dc2626', desc: 'Damaged / out of action' },
  { type: 'disabled', label: '⛔ Disabled', color: '#374151', desc: 'Stored / inactive' },
  { type: 'under_attack', label: '🚨 Under Attack', color: '#991b1b', desc: 'Currently under attack' },
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
  const { messages, units, groups } = useMissionStore();
  const user = useAuthStore((s) => s.user);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [recipientType, setRecipientType] = useState('system');
  const [recipientId, setRecipientId] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);

  /* Units grouped under their group for the selector */
  const groupedUnits = useMemo(() => {
    const grouped = {};
    const ungrouped = [];
    for (const u of units) {
      const g = groups.find((gr) => gr.id === u.group_id);
      if (g) {
        if (!grouped[g.id]) grouped[g.id] = { name: g.name, units: [] };
        grouped[g.id].units.push(u);
      } else {
        ungrouped.push(u);
      }
    }
    // Sort each group's units by callsign/name
    Object.values(grouped).forEach((g) =>
      g.units.sort((a, b) => (a.callsign || a.name).localeCompare(b.callsign || b.name))
    );
    ungrouped.sort((a, b) => (a.callsign || a.name).localeCompare(b.callsign || b.name));
    return { grouped, ungrouped };
  }, [units, groups]);

  /** Status message types that trigger unit-status updates when sent via System */
  const STATUS_MSG_TYPES = new Set([
    'boarding', 'ready_for_takeoff', 'on_the_way', 'arrived',
    'ready_for_orders', 'in_combat', 'heading_home', 'damaged', 'disabled', 'under_attack',
  ]);

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
          recipient_type: recipientType,
          recipient_id: recipientType !== 'all' && recipientType !== 'system' && recipientType !== 'lead'
            ? recipientId || null : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      // Immediately apply unit status updates to local store
      if (data.updated_units && data.updated_units.length > 0) {
        const { updateUnit } = useMissionStore.getState();
        data.updated_units.forEach((u) => updateUnit(u));
        const names = data.updated_units.map((u) => u.callsign || u.name).join(', ');
        toast.success(`Status → ${msgType.replace(/_/g, ' ')} (${names})`);
      } else {
        toast.success(`${msgType.replace(/_/g, ' ').toUpperCase()} sent`);
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  /* Recipient label for message feed */
  const recipientLabel = (msg) => {
    if (!msg.recipient_type || msg.recipient_type === 'all') return null;
    if (msg.recipient_type === 'unit') {
      const u = units.find((x) => x.id === msg.recipient_id);
      return `→ ${u ? (u.callsign || u.name) : 'Unit'}`;
    }
    if (msg.recipient_type === 'group') {
      const g = groups.find((x) => x.id === msg.recipient_id);
      return `→ ${g ? g.name : 'Group'}`;
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Reporting unit — grouped by group */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Reporting Unit (optional)</label>
        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          className="w-full bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
        >
          <option value="">— {user?.username || 'General'} (no unit) —</option>
          {Object.entries(groupedUnits.grouped).map(([gId, g]) => (
            <optgroup key={gId} label={g.name}>
              {g.units.map((u) => (
                <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
              ))}
            </optgroup>
          ))}
          {groupedUnits.ungrouped.length > 0 && (
            <optgroup label="Unassigned">
              {groupedUnits.ungrouped.map((u) => (
                <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Recipient selector */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Send To</label>
        <div className="flex gap-1 flex-wrap">
          {['all', 'lead', 'system', 'unit', 'group'].map((t) => (
            <button
              key={t}
              onClick={() => { setRecipientType(t); setRecipientId(''); }}
              className={`flex-1 min-w-[60px] text-xs py-1 rounded border transition-colors ${
                recipientType === t
                  ? 'border-krt-accent text-krt-accent bg-krt-accent/10'
                  : 'border-krt-border text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'all' ? '📢 All' : t === 'lead' ? '⭐ Lead' : t === 'system' ? '🖥️ System' : t === 'unit' ? '🚀 Unit' : '👥 Group'}
            </button>
          ))}
        </div>
        {recipientType === 'unit' && (
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className="w-full mt-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">Select unit…</option>
            {Object.entries(groupedUnits.grouped).map(([gId, g]) => (
              <optgroup key={gId} label={g.name}>
                {g.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
                ))}
              </optgroup>
            ))}
            {groupedUnits.ungrouped.map((u) => (
              <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
            ))}
          </select>
        )}
        {recipientType === 'group' && (
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className="w-full mt-1 bg-krt-bg border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent"
          >
            <option value="">Select group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
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

      {/* System mode hint */}
      {recipientType === 'system' && (
        <div className="text-[10px] text-krt-accent bg-krt-accent/5 border border-krt-accent/20 rounded px-2 py-1">
          🖥️ System mode — Status buttons will auto-update the selected unit's status.
          {selectedUnit && (() => {
            const u = units.find((x) => x.id === selectedUnit);
            return u?.unit_type === 'person' && u?.parent_unit_id
              ? ' If all crew share the same status, the ship status updates too.'
              : null;
          })()}
        </div>
      )}

      {/* Message feed — system status messages are hidden (they're status updates, not chat) */}
      <div className="border-t border-krt-border pt-2">
        <label className="text-xs text-gray-500 block mb-1">Recent Messages</label>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {messages.filter((m) => m.recipient_type !== 'system').length === 0 && (
            <p className="text-gray-600 text-xs text-center py-2">No messages yet</p>
          )}
          {messages.filter((m) => m.recipient_type !== 'system').map((msg) => {
            const btn = MSG_BUTTONS.find((b) => b.type === msg.message_type);
            const isAlert = msg.message_type === 'under_attack';
            const recip = recipientLabel(msg);
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 text-xs p-1.5 rounded ${
                  isAlert ? 'bg-red-900/30 border border-red-800' : 'bg-krt-bg/30'
                }`}
              >
                <span style={{ color: isAlert ? '#ef4444' : (btn?.color || '#9ca3af') }}>
                  {isAlert ? '🚨' : msg.message_type === 'custom' ? '💬' : (btn?.label?.split(' ')[0] || '📝')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-gray-300 font-medium">{msg.user_name || 'Unknown'}</span>
                    {msg.unit_name && <span className="text-gray-600">({msg.unit_name})</span>}
                    {recip && <span className="text-krt-accent text-[10px]">{recip}</span>}
                    <span className="text-gray-700 ml-auto whitespace-nowrap">{timeAgo(msg.created_at)}</span>
                  </div>
                  <span className={isAlert ? 'text-red-400 font-bold' : 'text-gray-400'}>
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
