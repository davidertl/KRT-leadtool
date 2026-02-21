import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [publicMissions, setPublicMissions] = useState([]);
  const [newMissionName, setNewMissionName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/missions', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/missions/public', { credentials: 'include' }).then((r) => r.json()).catch(() => []),
    ]).then(([mine, pub]) => {
      setMissions(Array.isArray(mine) ? mine : []);
      setPublicMissions(Array.isArray(pub) ? pub : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const createMission = async (e) => {
    e.preventDefault();
    if (!newMissionName.trim()) return;

    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newMissionName.trim() }),
    });

    if (res.ok) {
      const mission = await res.json();
      setMissions((prev) => [mission, ...prev]);
      setNewMissionName('');
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    try {
      const res = await fetch('/api/members/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ join_code: joinCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Join request sent!');
        setJoinCode('');
      } else if (res.status === 409) {
        toast.error(data.error || 'Already a member');
      } else {
        toast.error(data.error || 'Failed to join');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleJoinPublic = async (missionId) => {
    try {
      const res = await fetch('/api/members/join-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_id: missionId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Joined mission!');
        // Refresh my missions
        const mine = await fetch('/api/missions', { credentials: 'include' }).then((r) => r.json());
        setMissions(Array.isArray(mine) ? mine : []);
      } else {
        toast.error(data.error || 'Failed to join');
      }
    } catch { toast.error('Network error'); }
  };

  const handleLeave = async (missionId, missionName) => {
    if (!confirm(`Leave "${missionName}"? You will lose access.`)) return;
    try {
      const res = await fetch(`/api/members/${missionId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      setMissions((prev) => prev.filter((m) => m.id !== missionId));
      toast.success(`Left "${missionName}"`);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (missionId, missionName) => {
    if (!confirm(`DELETE "${missionName}"? This cannot be undone!`)) return;
    try {
      const res = await fetch(`/api/missions/${missionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      setMissions((prev) => prev.filter((m) => m.id !== missionId));
      toast.success(`Deleted "${missionName}"`);
    } catch (err) { toast.error(err.message); }
  };

  const isOwner = (mission) => mission.owner_id === user?.id;

  return (
    <div className="min-h-screen bg-krt-bg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">KRT Leadtool</h1>
          <p className="text-gray-400 text-sm">Welcome, {user?.username}</p>
        </div>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Create mission */}
        <form onSubmit={createMission} className="flex gap-3 mb-4">
          <input
            type="text"
            value={newMissionName}
            onChange={(e) => setNewMissionName(e.target.value)}
            placeholder="New mission name..."
            className="flex-1 bg-krt-panel border border-krt-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
          />
          <button
            type="submit"
            className="bg-krt-accent hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Create Mission
          </button>
        </form>

        {/* Join by code */}
        <form onSubmit={handleJoinByCode} className="flex gap-3 mb-8">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter join code..."
            maxLength={8}
            className="flex-1 bg-krt-panel border border-krt-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent font-mono tracking-wider uppercase"
          />
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Join Mission
          </button>
        </form>

        {/* My missions */}
        <h2 className="text-lg font-semibold text-white mb-3">My Missions</h2>
        {loading ? (
          <p className="text-gray-400 text-center">Loading missions...</p>
        ) : missions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg mb-2">No missions yet</p>
            <p className="text-sm">Create your first mission above to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {missions.map((mission) => (
              <div
                key={mission.id}
                className="bg-krt-panel border border-krt-border rounded-xl p-5 hover:border-krt-accent transition-colors group relative"
              >
                <button
                  onClick={() => navigate(`/map/${mission.id}`)}
                  className="text-left w-full"
                >
                  <h3 className="text-lg font-semibold group-hover:text-krt-accent transition-colors">
                    {mission.name}
                    {mission.is_public && <span className="ml-2 text-xs text-green-400">🌐</span>}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {mission.description || 'No description'}
                  </p>
                  <p className="text-gray-600 text-xs mt-3">
                    Created {new Date(mission.created_at).toLocaleDateString()}
                    {isOwner(mission) && <span className="ml-2 text-krt-accent">👑 Owner</span>}
                  </p>
                </button>

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isOwner(mission) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLeave(mission.id, mission.name); }}
                      className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/20"
                      title="Leave mission"
                    >
                      🚪 Leave
                    </button>
                  )}
                  {isOwner(mission) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(mission.id, mission.name); }}
                      className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500/20"
                      title="Delete mission"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Public missions */}
        {publicMissions.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-white mb-3">🌐 Public Missions</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {publicMissions
                .filter((pm) => !missions.some((m) => m.id === pm.id))
                .map((pm) => (
                  <div
                    key={pm.id}
                    className="bg-krt-panel border border-krt-border rounded-xl p-5 flex items-start justify-between"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-white">{pm.name}</h3>
                      <p className="text-gray-500 text-xs mt-1">{pm.description || 'No description'}</p>
                      <p className="text-gray-600 text-[10px] mt-2">
                        {pm.member_count} member{pm.member_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoinPublic(pm.id)}
                      className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                    >
                      Join
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
