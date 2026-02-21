import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const EVENT_TYPES = [
  { value: 'contact',         icon: '📡', label: 'Contact' },
  { value: 'kill',            icon: '💀', label: 'Kill' },
  { value: 'loss',            icon: '💔', label: 'Loss' },
  { value: 'rescue',          icon: '🚑', label: 'Rescue' },
  { value: 'task_update',     icon: '📋', label: 'Task' },
  { value: 'position_report', icon: '📍', label: 'Position' },
  { value: 'intel',           icon: '🔍', label: 'Intel' },
  { value: 'login',           icon: '🟢', label: 'Login' },
  { value: 'logout',          icon: '🔴', label: 'Logout' },
  { value: 'phase_change',    icon: '⚡', label: 'Phase Change' },
  { value: 'phase_created',   icon: '📋', label: 'Phase Created' },
  { value: 'phase_deleted',   icon: '🗑️', label: 'Phase Deleted' },
  { value: 'op_created',      icon: '🎖️', label: 'Op Created' },
  { value: 'roe_changed',     icon: '🎯', label: 'ROE Changed' },
  { value: 'status_change',   icon: '🔄', label: 'Status Change' },
  { value: 'alert',           icon: '🚨', label: 'Alert' },
  { value: 'custom',          icon: '📝', label: 'Custom' },
];

const EVENT_ICONS = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.icon]));
const EVENT_COLORS = {
  contact: 'border-purple-500/30',
  kill: 'border-red-500/30',
  loss: 'border-red-700/30',
  rescue: 'border-green-500/30',
  task_update: 'border-blue-500/30',
  position_report: 'border-gray-500/30',
  intel: 'border-cyan-500/30',
  login: 'border-green-400/30',
  logout: 'border-yellow-500/30',
  phase_change: 'border-amber-500/30',
  phase_created: 'border-amber-400/30',
  phase_deleted: 'border-red-400/30',
  op_created: 'border-blue-400/30',
  roe_changed: 'border-orange-500/30',
  status_change: 'border-teal-400/30',
  alert: 'border-red-400/30',
  custom: 'border-gray-400/30',
};

/* Manual-entry event types (subset for dropdown) */
const MANUAL_EVENT_TYPES = EVENT_TYPES.filter(
  (t) => !['login', 'logout', 'phase_change', 'phase_created', 'phase_deleted', 'op_created', 'roe_changed', 'status_change'].includes(t.value)
);

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Event log / mission timeline — displays chronological events with filters, manual entry, export
 */
export default function EventLog({ missionId }) {
  const { events, units } = useMissionStore();
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState(new Set(EVENT_TYPES.map((t) => t.value))); // all checked by default
  const [unitFilter, setUnitFilter] = useState('');
  const [timeRange, setTimeRange] = useState(0); // 0 = all, value in seconds
  const [showManual, setShowManual] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef(null);

  const TIME_RANGES = [
    { value: 0, label: 'All' },
    { value: 30, label: '30s' },
    { value: 60, label: '1m' },
    { value: 120, label: '2m' },
    { value: 300, label: '5m' },
    { value: 600, label: '10m' },
    { value: 900, label: '15m' },
    { value: 1800, label: '30m' },
    { value: 3600, label: '1h' },
  ];

  /* Manual entry state */
  const [manualType, setManualType] = useState('custom');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDetails, setManualDetails] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  /* Close type dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setShowTypeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleType = (value) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const selectAllTypes = () => setActiveTypes(new Set(EVENT_TYPES.map((t) => t.value)));
  const selectNoneTypes = () => setActiveTypes(new Set());

  /* Filtered events */
  const filtered = useMemo(() => {
    let list = events;
    // Type filter — check both 'event' and 'event_type' fields (legacy support)
    if (activeTypes.size < EVENT_TYPES.length) {
      list = list.filter((e) => activeTypes.has(e.event) || activeTypes.has(e.event_type));
    }
    if (unitFilter) list = list.filter((e) => e.unit_id === unitFilter);
    if (timeRange > 0) {
      const cutoff = Date.now() - timeRange * 1000;
      list = list.filter((e) => new Date(e.created_at).getTime() >= cutoff);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.details || '').toLowerCase().includes(q) ||
        (e.message || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, activeTypes, unitFilter, timeRange, search]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ mission_id: missionId });
      if (unitFilter) params.set('unit_id', unitFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/events/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported CSV');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mission_id: missionId,
          event: manualType,
          title: manualTitle.trim(),
          details: manualDetails || null,
          unit_id: manualUnit || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Event logged');
      setManualTitle('');
      setManualDetails('');
      setManualUnit('');
      setShowManual(false);
    } catch {
      toast.error('Failed to log event');
    }
  };

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-1 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search…"
          className="flex-1 min-w-[100px] bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
        />

        {/* Multi-select type dropdown */}
        <div className="relative" ref={typeDropdownRef}>
          <button
            onClick={() => setShowTypeDropdown((v) => !v)}
            className="bg-krt-bg border border-krt-border rounded px-2 py-1 text-xs text-white hover:border-krt-accent flex items-center gap-1"
          >
            <span>Types</span>
            <span className="text-[10px] text-gray-500">
              ({activeTypes.size}/{EVENT_TYPES.length})
            </span>
            <span className="text-[10px]">{showTypeDropdown ? '▲' : '▼'}</span>
          </button>
          {showTypeDropdown && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-krt-panel border border-krt-border rounded shadow-lg w-48 max-h-64 overflow-y-auto">
              <div className="flex gap-1 px-2 py-1 border-b border-krt-border">
                <button onClick={selectAllTypes} className="text-[10px] text-krt-accent hover:underline">All</button>
                <span className="text-gray-600 text-[10px]">|</span>
                <button onClick={selectNoneTypes} className="text-[10px] text-gray-400 hover:underline">None</button>
              </div>
              {EVENT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-krt-bg/50 cursor-pointer text-xs text-white"
                >
                  <input
                    type="checkbox"
                    checked={activeTypes.has(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="rounded border-krt-border text-krt-accent focus:ring-0 focus:ring-offset-0"
                  />
                  <span>{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="bg-krt-bg border border-krt-border rounded px-1 py-1 text-xs text-white"
        >
          <option value="">All units</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
          ))}
        </select>

        {/* Time range pills */}
        <div className="flex flex-wrap gap-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                timeRange === r.value
                  ? 'bg-krt-accent text-white'
                  : 'bg-krt-bg text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="text-xs text-krt-accent hover:text-blue-400"
        >
          + Manual Entry
        </button>
        <button
          onClick={handleExport}
          className="text-xs text-gray-400 hover:text-white ml-auto"
        >
          📥 Export CSV
        </button>
        <span className="text-[10px] text-gray-600">{filtered.length} events</span>
      </div>

      {/* Manual entry form */}
      {showManual && (
        <form onSubmit={handleManualEntry} className="bg-krt-bg/80 rounded p-2 space-y-1 border border-krt-border">
          <div className="flex gap-1">
            <select
              value={manualType}
              onChange={(e) => setManualType(e.target.value)}
              className="bg-krt-panel border border-krt-border rounded px-1 py-1 text-xs text-white"
            >
              {MANUAL_EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={manualUnit}
              onChange={(e) => setManualUnit(e.target.value)}
              className="bg-krt-panel border border-krt-border rounded px-1 py-1 text-xs text-white"
            >
              <option value="">No unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.callsign || u.name}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Event title…"
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent"
            autoFocus
          />
          <textarea
            value={manualDetails}
            onChange={(e) => setManualDetails(e.target.value)}
            placeholder="Details (optional)…"
            rows={2}
            className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-krt-accent resize-none"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-krt-accent text-white text-xs px-3 py-1 rounded">Log</button>
            <button type="button" onClick={() => setShowManual(false)} className="text-gray-400 text-xs">Cancel</button>
          </div>
        </form>
      )}

      {/* Event list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            {events.length === 0 ? 'No events logged yet.' : 'No events match filters.'}
          </p>
        )}

        {filtered.map((event) => {
          const evType = event.event || event.event_type;
          const icon = EVENT_ICONS[evType] || '📝';
          const borderColor = EVENT_COLORS[evType] || 'border-gray-500/30';

          return (
            <div
              key={event.id}
              className={`p-2 rounded-lg bg-krt-bg/50 border-l-2 ${borderColor}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white truncate">
                      {event.title || event.message || evType}
                    </span>
                    <span className="text-[10px] text-gray-600 whitespace-nowrap ml-2">
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                  {(event.details || event.message) && event.title && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                      {event.details || event.message}
                    </p>
                  )}
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {event.user_name && <span>{event.user_name}</span>}
                    {event.unit_name && <span className="ml-1">• {event.unit_name}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
