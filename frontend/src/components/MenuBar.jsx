import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopupStore } from '../stores/popupStore';
import { useMissionStore } from '../stores/missionStore';
import { useAuthStore } from '../stores/authStore';

/**
 * Horizontal menu bar replacing the sidebar tab navigation.
 * Sits at the top of the map view; toggles popup windows.
 */

const MENU_ITEMS = [
  { id: 'ops',         hotkey: '1' },
  { id: 'groups',      hotkey: '2' },
  { id: 'units',       hotkey: '3' },
  { id: 'persons',     hotkey: '4' },
  { id: 'contacts',    hotkey: '5' },
  { id: 'comms',       hotkey: '6' },
  { id: 'tasks',       hotkey: '7' },
  { id: 'log',         hotkey: '8' },
  { id: 'multiplayer', hotkey: '9' },
  { id: 'bookmarks',   hotkey: '0' },
  { id: 'selected',    hotkey: null },
];

export default function MenuBar({ onBack }) {
  const { user } = useAuthStore();
  const { popups, togglePopup, closeAll } = usePopupStore();
  const {
    units, groups, contacts, tasks, selectedUnitIds,
    operations, events, messages, bookmarks, joinRequests, myMissionRole,
  } = useMissionStore();
  const navigate = useNavigate();

  /** Badge counts */
  const vehicleCount = units.filter((u) => u.unit_type !== 'person').length;
  const personCount = units.filter((u) => u.unit_type === 'person').length;
  const counts = {
    units: vehicleCount,
    persons: personCount,
    groups: groups.length,
    contacts: contacts.filter((c) => c.is_active).length,
    tasks: tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length,
    selected: selectedUnitIds.length,
    ops: operations.filter((o) => o.phase !== 'complete').length,
    comms: 0,
    log: events.length,
    bookmarks: bookmarks.length,
    multiplayer: joinRequests.length,
  };

  // Keyboard shortcuts (Alt+number)
  React.useEffect(() => {
    const handler = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const item = MENU_ITEMS.find((m) => m.hotkey && m.hotkey === e.key);
        if (item) {
          e.preventDefault();
          togglePopup(item.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePopup]);

  return (
    <div className="h-10 bg-krt-panel/95 backdrop-blur-sm border-b border-krt-border flex items-center gap-0.5 px-2 shrink-0 select-none z-[200]">
      {/* Back button */}
      <button
        onClick={() => { onBack ? onBack() : navigate('/'); }}
        className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-krt-border/30 transition-colors mr-1"
        title="Back to dashboard"
      >
        ← Back
      </button>

      <div className="w-px h-5 bg-krt-border mx-1" />

      {/* Menu buttons */}
      {MENU_ITEMS.map((item) => {
        const p = popups[item.id];
        if (!p) return null;
        const isOpen = p.open;
        const count = counts[item.id];
        const hasActivity = item.id === 'multiplayer' && joinRequests.length > 0;
        const hasActiveOp = item.id === 'ops' && counts.ops > 0;

        return (
          <button
            key={item.id}
            onClick={() => togglePopup(item.id)}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded transition-colors whitespace-nowrap ${
              isOpen
                ? 'bg-krt-accent/20 text-krt-accent border border-krt-accent/40'
                : 'text-gray-400 hover:text-gray-200 hover:bg-krt-border/30 border border-transparent'
            }`}
            title={`${p.label}${item.hotkey ? ` (Alt+${item.hotkey})` : ''}`}
          >
            <span>{p.icon}</span>
            <span className="hidden lg:inline">{p.label}</span>
            {count > 0 && (
              <span className={`text-[10px] px-1 rounded-full min-w-[16px] text-center ${
                hasActivity ? 'bg-red-500 text-white' :
                hasActiveOp ? 'bg-amber-500 text-white' :
                isOpen ? 'bg-krt-accent/30 text-krt-accent' : 'bg-krt-border text-gray-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Close all */}
      <button
        onClick={closeAll}
        className="text-gray-600 hover:text-gray-400 text-[10px] px-2 py-1 rounded hover:bg-krt-border/30 transition-colors"
        title="Close all windows"
      >
        Close All
      </button>

      <div className="w-px h-5 bg-krt-border mx-1" />

      {/* User info */}
      <div className="text-right flex items-center gap-2">
        <span className="text-xs text-gray-500">{user?.username}</span>
        {myMissionRole && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            myMissionRole === 'gesamtlead' ? 'bg-red-500/20 text-red-400' :
            myMissionRole === 'gruppenlead' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {myMissionRole === 'gesamtlead' ? 'Gesamtlead' :
             myMissionRole === 'gruppenlead' ? 'Gruppenlead' : 'Teamlead'}
          </span>
        )}
      </div>
    </div>
  );
}
