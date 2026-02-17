import React, { useState, useEffect } from 'react';
import { onConnectionStatusChange, getConnectionStatus } from '../lib/socket';

const STATUS_CONFIG = {
  connected: { color: 'bg-green-500', label: 'Connected', pulse: false },
  disconnected: { color: 'bg-red-500', label: 'Disconnected', pulse: false },
  reconnecting: { color: 'bg-yellow-500', label: 'Reconnecting…', pulse: true },
};

export default function ConnectionStatus() {
  const [status, setStatus] = useState(getConnectionStatus());

  useEffect(() => {
    return onConnectionStatusChange(setStatus);
  }, []);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  return (
    <div className="absolute top-3 right-3 flex items-center gap-2 bg-krt-panel/80 border border-krt-border rounded-full px-3 py-1.5 backdrop-blur-sm z-10">
      <span className={`w-2 h-2 rounded-full ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-400">{cfg.label}</span>
    </div>
  );
}
