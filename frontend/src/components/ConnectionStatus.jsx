import React, { useState, useEffect } from 'react';
import { onConnectionStatusChange, getConnectionStatus } from '../lib/socket';
import { CONNECTION_STATUS } from '../lib/constants';

export default function ConnectionStatus() {
  const [status, setStatus] = useState(getConnectionStatus());

  useEffect(() => {
    return onConnectionStatusChange(setStatus);
  }, []);

  const cfg = CONNECTION_STATUS[status] || CONNECTION_STATUS.disconnected;

  return (
    <div className="absolute top-3 right-3 flex items-center gap-2 bg-krt-panel/80 border border-krt-border rounded-full px-3 py-1.5 backdrop-blur-sm z-10">
      <span className={`w-2 h-2 rounded-full ${cfg.pulse ? 'animate-pulse' : ''}`} style={{ backgroundColor: cfg.color }} />
      <span className="text-xs text-gray-400">{cfg.label}</span>
    </div>
  );
}
