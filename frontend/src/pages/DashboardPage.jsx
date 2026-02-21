import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [newMissionName, setNewMissionName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/missions', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setMissions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

        {/* Mission list */}
        {loading ? (
          <p className="text-gray-400 text-center">Loading missions...</p>
        ) : missions.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg mb-2">No missions yet</p>
            <p className="text-sm">Create your first mission above to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {missions.map((mission) => (
              <button
                key={mission.id}
                onClick={() => navigate(`/map/${mission.id}`)}
                className="bg-krt-panel border border-krt-border rounded-xl p-5 text-left hover:border-krt-accent transition-colors group"
              >
                <h3 className="text-lg font-semibold group-hover:text-krt-accent transition-colors">
                  {mission.name}
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {mission.description || 'No description'}
                </p>
                <p className="text-gray-600 text-xs mt-3">
                  Created {new Date(mission.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
