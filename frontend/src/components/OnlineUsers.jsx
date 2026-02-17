import React from 'react';
import { useMissionStore } from '../stores/missionStore';

/**
 * Shows currently online users in the team (bottom-right overlay)
 */
export default function OnlineUsers() {
  const { onlineUsers } = useMissionStore();

  if (onlineUsers.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 bg-krt-panel/80 backdrop-blur-sm border border-krt-border rounded-lg p-3 max-w-xs">
      <p className="text-xs text-gray-400 mb-2">Online ({onlineUsers.length})</p>
      <div className="flex flex-wrap gap-2">
        {onlineUsers.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-1.5 bg-krt-bg/50 rounded-full px-2 py-1"
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-300">{u.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
