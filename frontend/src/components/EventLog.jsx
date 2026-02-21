import React from 'react';
import { useMissionStore } from '../stores/missionStore';

const EVENT_ICONS = {
  contact: '📡',
  kill: '💀',
  loss: '💔',
  rescue: '🚑',
  task_update: '📋',
  position_report: '📍',
  intel: '🔍',
  check_in: '✅',
  check_out: '🚪',
  phase_change: '⚡',
  alert: '🚨',
  custom: '📝',
};

const EVENT_COLORS = {
  contact: 'border-purple-500/30',
  kill: 'border-red-500/30',
  loss: 'border-red-700/30',
  rescue: 'border-green-500/30',
  task_update: 'border-blue-500/30',
  position_report: 'border-gray-500/30',
  intel: 'border-cyan-500/30',
  check_in: 'border-green-400/30',
  check_out: 'border-yellow-500/30',
  phase_change: 'border-amber-500/30',
  alert: 'border-red-400/30',
  custom: 'border-gray-400/30',
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Event log / mission timeline — displays chronological events
 */
export default function EventLog({ missionId }) {
  const { events } = useMissionStore();

  return (
    <div className="space-y-1">
      {events.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">
          No events logged yet. Events appear automatically as actions occur.
        </p>
      )}

      {events.map((event) => {
        const icon = EVENT_ICONS[event.event] || '📝';
        const borderColor = EVENT_COLORS[event.event] || 'border-gray-500/30';

        return (
          <div
            key={event.id}
            className={`p-2 rounded-lg bg-krt-bg/50 border-l-2 ${borderColor}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white truncate">{event.title}</span>
                  <span className="text-[10px] text-gray-600 whitespace-nowrap ml-2">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
                {event.details && (
                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{event.details}</p>
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
  );
}
