import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setTeams(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const createTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newTeamName.trim() }),
    });

    if (res.ok) {
      const team = await res.json();
      setTeams((prev) => [team, ...prev]);
      setNewTeamName('');
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
        {/* Create team */}
        <form onSubmit={createTeam} className="flex gap-3 mb-8">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
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

        {/* Team list */}
        {loading ? (
          <p className="text-gray-400 text-center">Loading missions...</p>
        ) : teams.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg mb-2">No missions yet</p>
            <p className="text-sm">Create your first mission above to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => navigate(`/map/${team.id}`)}
                className="bg-krt-panel border border-krt-border rounded-xl p-5 text-left hover:border-krt-accent transition-colors group"
              >
                <h3 className="text-lg font-semibold group-hover:text-krt-accent transition-colors">
                  {team.name}
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {team.description || 'No description'}
                </p>
                <p className="text-gray-600 text-xs mt-3">
                  Created {new Date(team.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
