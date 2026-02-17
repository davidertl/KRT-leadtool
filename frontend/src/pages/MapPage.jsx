import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMissionStore } from '../stores/missionStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import SpaceMap from '../components/SpaceMap';
import Sidebar from '../components/Sidebar';
import OnlineUsers from '../components/OnlineUsers';

export default function MapPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { setTeamId, setUnits, setGroups, setLastSyncTime, loadFromCache } = useMissionStore();

  useEffect(() => {
    setTeamId(teamId);

    // Load cached data first (offline support)
    loadFromCache(teamId);

    // Fetch fresh data from server
    Promise.all([
      fetch(`/api/units?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/groups?team_id=${teamId}`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([units, groups]) => {
        setUnits(Array.isArray(units) ? units : []);
        setGroups(Array.isArray(groups) ? groups : []);
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
        <OnlineUsers />
      </div>
    </div>
  );
}
