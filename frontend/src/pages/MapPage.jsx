import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMissionStore } from '../stores/missionStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import SpaceMap from '../components/SpaceMap';
import Sidebar from '../components/Sidebar';
import OnlineUsers from '../components/OnlineUsers';
import ConnectionStatus from '../components/ConnectionStatus';

export default function MapPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { setTeamId, setUnits, setGroups, setContacts, setTasks, setOperations, setEvents, setMessages, setBookmarks, setNavData, setActiveSystemId, setLastSyncTime, loadFromCache } = useMissionStore();

  useEffect(() => {
    setTeamId(teamId);

    // Load cached data first (offline support)
    loadFromCache(teamId);

    // Fetch fresh data from server
    Promise.all([
      fetch(`/api/units?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/groups?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/contacts?team_id=${teamId}&active_only=true`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/tasks?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/operations?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/events?team_id=${teamId}&limit=100`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/messages?team_id=${teamId}&limit=100`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/bookmarks?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/navigation/systems`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([units, groups, contacts, tasks, operations, events, messages, bookmarks, systems]) => {
        setUnits(Array.isArray(units) ? units : []);
        setGroups(Array.isArray(groups) ? groups : []);
        setContacts(Array.isArray(contacts) ? contacts : []);
        setTasks(Array.isArray(tasks) ? tasks : []);
        setOperations(Array.isArray(operations) ? operations : []);
        setEvents(Array.isArray(events) ? events : []);
        setMessages(Array.isArray(messages) ? messages : []);
        setBookmarks(Array.isArray(bookmarks) ? bookmarks : []);

        // Load first system navigation data
        if (Array.isArray(systems) && systems.length > 0) {
          setActiveSystemId(systems[0].id);
          fetch(`/api/navigation/systems/${systems[0].id}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
              setNavData({
                systems,
                bodies: data.celestial_bodies || [],
                points: data.navigation_points || [],
                edges: data.jump_edges || [],
              });
            })
            .catch(() => {});
        } else {
          setNavData({ systems: Array.isArray(systems) ? systems : [], bodies: [], points: [], edges: [] });
        }

        setLastSyncTime(new Date().toISOString());
      })
      .catch(() => {
        // Using cached data if offline
      });

    // Connect WebSocket
    const socket = connectSocket(teamId);

    return () => {
      disconnectSocket();
    };
  }, [teamId]);

  return (
    <div className="flex h-screen w-screen bg-krt-bg overflow-hidden">
      {/* Sidebar */}
      <Sidebar onBack={() => navigate('/')} />

      {/* 3D Map */}
      <div className="flex-1 relative">
        <SpaceMap />
        <ConnectionStatus />
        <OnlineUsers />
      </div>
    </div>
  );
}
