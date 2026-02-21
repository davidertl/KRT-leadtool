import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMissionStore } from '../stores/missionStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import SpaceMap from '../components/SpaceMap';
import MenuBar from '../components/MenuBar';
import PopupPanels from '../components/PopupPanels';
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
  const { missionId } = useParams();
  const navigate = useNavigate();
  const {
    setMissionId, setUnits, setGroups, setWaypoints, setContacts, setTasks,
    setOperations, setEvents, setMessages, setBookmarks, setNavData,
    setActiveSystemId, setLastSyncTime, loadFromCache,
    setMembers, setJoinRequests, setMyMissionRole, setMyAssignedGroups,
    addJoinRequest, removeJoinRequest,
  } = useMissionStore();

  useEffect(() => {
    setMissionId(missionId);

    // Load cached data first (offline support)
    loadFromCache(missionId);

    const creds = { credentials: 'include' };

    // Fetch fresh data from server
    Promise.all([
      safeFetch(`/api/units?mission_id=${missionId}`, creds),
      safeFetch(`/api/groups?mission_id=${missionId}`, creds),
      safeFetch(`/api/contacts?mission_id=${missionId}&active_only=true`, creds),
      safeFetch(`/api/tasks?mission_id=${missionId}`, creds),
      safeFetch(`/api/operations?mission_id=${missionId}`, creds),
      safeFetch(`/api/events?mission_id=${missionId}&limit=100`, creds),
      safeFetch(`/api/messages?mission_id=${missionId}&limit=100`, creds),
      safeFetch(`/api/bookmarks?mission_id=${missionId}`, creds),
      safeFetch(`/api/navigation/systems`, creds),
      safeFetch(`/api/waypoints?mission_id=${missionId}`, creds),
      safeFetch(`/api/members/${missionId}/members`, creds),
      safeFetch(`/api/members/${missionId}/requests`, creds),
      safeFetch(`/api/missions/${missionId}`, creds, null),
    ])
      .then(([units, groups, contacts, tasks, operations, events, messages, bookmarks, systems, waypoints, members, joinRequests, missionInfo]) => {
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

        // Set current user's mission role from the mission info
        if (missionInfo && missionInfo.mission_role) {
          setMyMissionRole(missionInfo.mission_role);
          setMyAssignedGroups(missionInfo.assigned_group_ids || []);
        }

        // Load first system navigation data
        if (Array.isArray(systems) && systems.length > 0) {
          setActiveSystemId(systems[0].id);
          safeFetch(`/api/navigation/systems/${systems[0].id}`, creds, {})
            .then((data) => {
              const bodies = data.celestial_bodies || [];
              const points = data.navigation_points || [];
              setNavData({
                systems,
                bodies,
                points,
                edges: data.jump_edges || [],
              });
              if (bodies.length === 0 && points.length === 0) {
                toast('No star map data loaded — use "Update Starmap" in Multiplayer settings', { icon: '⚠️' });
              }
            });
        } else {
          setNavData({ systems: Array.isArray(systems) ? systems : [], bodies: [], points: [], edges: [] });
          toast('No star systems found — use "Update Starmap" in Multiplayer settings', { icon: '⚠️' });
        }

        setLastSyncTime(new Date().toISOString());
      })
      .catch((err) => {
        console.warn('[KRT] Initial data load failed:', err.message);
        toast.error('Failed to load data — using cache');
      });

    // Connect WebSocket
    const socket = connectSocket(missionId);

    return () => {
      disconnectSocket();
    };
  }, [missionId]);

  return (
    <div className="flex flex-col h-screen w-screen bg-krt-bg overflow-hidden">
      {/* Horizontal menu bar at the top */}
      <MenuBar />

      {/* Full-width 3D map with floating popup windows */}
      <div className="flex-1 relative">
        <SpaceMap />
        <ConnectionStatus />
        <OnlineUsers />
        <PopupPanels />
      </div>
    </div>
  );
}
