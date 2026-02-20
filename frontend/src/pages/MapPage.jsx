import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMissionStore } from '../stores/missionStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import SpaceMap from '../components/SpaceMap';
import Sidebar from '../components/Sidebar';
import OnlineUsers from '../components/OnlineUsers';
import ConnectionStatus from '../components/ConnectionStatus';
import toast from 'react-hot-toast';

/** Safe fetch wrapper — returns fallback on non-ok or network error */
async function safeFetch(url, opts, fallback = []) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      console.warn(`[KRT] ${url} responded ${res.status}`);
      return fallback;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[KRT] ${url} failed:`, err.message);
    return fallback;
  }
}

export default function MapPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const {
    setTeamId, setUnits, setGroups, setWaypoints, setContacts, setTasks,
    setOperations, setEvents, setMessages, setBookmarks, setNavData,
    setActiveSystemId, setLastSyncTime, loadFromCache,
    setMembers, setJoinRequests, setMyMissionRole, setMyAssignedGroups,
    addJoinRequest, removeJoinRequest,
  } = useMissionStore();

  useEffect(() => {
    setTeamId(teamId);

    // Load cached data first (offline support)
    loadFromCache(teamId);

    const creds = { credentials: 'include' };

    // Fetch fresh data from server
    Promise.all([
      safeFetch(`/api/units?team_id=${teamId}`, creds),
      safeFetch(`/api/groups?team_id=${teamId}`, creds),
      safeFetch(`/api/contacts?team_id=${teamId}&active_only=true`, creds),
      safeFetch(`/api/tasks?team_id=${teamId}`, creds),
      safeFetch(`/api/operations?team_id=${teamId}`, creds),
      safeFetch(`/api/events?team_id=${teamId}&limit=100`, creds),
      safeFetch(`/api/messages?team_id=${teamId}&limit=100`, creds),
      safeFetch(`/api/bookmarks?team_id=${teamId}`, creds),
      safeFetch(`/api/navigation/systems`, creds),
      safeFetch(`/api/waypoints?team_id=${teamId}`, creds),
      safeFetch(`/api/members/${teamId}/members`, creds),
      safeFetch(`/api/members/${teamId}/requests`, creds),
      safeFetch(`/api/teams/${teamId}`, creds, null),
    ])
      .then(([units, groups, contacts, tasks, operations, events, messages, bookmarks, systems, waypoints, members, joinRequests, teamInfo]) => {
        setUnits(Array.isArray(units) ? units : []);
        setGroups(Array.isArray(groups) ? groups : []);
        setContacts(Array.isArray(contacts) ? contacts : []);
        setTasks(Array.isArray(tasks) ? tasks : []);
        setOperations(Array.isArray(operations) ? operations : []);
        setEvents(Array.isArray(events) ? events : []);
        setMessages(Array.isArray(messages) ? messages : []);
        setBookmarks(Array.isArray(bookmarks) ? bookmarks : []);
        setWaypoints(Array.isArray(waypoints) ? waypoints : []);
        setMembers(Array.isArray(members) ? members : []);
        setJoinRequests(Array.isArray(joinRequests) ? joinRequests : []);

        // Set current user's mission role from the team info
        if (teamInfo && teamInfo.mission_role) {
          setMyMissionRole(teamInfo.mission_role);
          setMyAssignedGroups(teamInfo.assigned_group_ids || []);
        }

        // Load first system navigation data
        if (Array.isArray(systems) && systems.length > 0) {
          setActiveSystemId(systems[0].id);
          safeFetch(`/api/navigation/systems/${systems[0].id}`, creds, {})
            .then((data) => {
              setNavData({
                systems,
                bodies: data.celestial_bodies || [],
                points: data.navigation_points || [],
                edges: data.jump_edges || [],
              });
            });
        } else {
          setNavData({ systems: Array.isArray(systems) ? systems : [], bodies: [], points: [], edges: [] });
        }

        setLastSyncTime(new Date().toISOString());
      })
      .catch((err) => {
        console.warn('[KRT] Initial data load failed:', err.message);
        toast.error('Failed to load data — using cache');
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
