import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  gesamtlead: { label: 'Gesamtlead', color: '#ef4444', desc: 'Full access' },
  gruppenlead: { label: 'Gruppenlead', color: '#f59e0b', desc: 'Manage assigned groups' },
  teamlead: { label: 'Teamlead', color: '#3b82f6', desc: 'Read-only + comms' },
};

/** Badge for a mission role */
function RoleBadge({ role }) {
  const info = ROLE_LABELS[role] || ROLE_LABELS.teamlead;
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: info.color + '20', color: info.color }}
    >
      {info.label}
    </span>
  );
}

export default function MultiplayerPanel({ missionId }) {
  const { members, joinRequests, groups, myMissionRole, onlineUsers, removeJoinRequest, addJoinRequest } = useMissionStore();
  const canManage = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';

  return (
    <div className="space-y-4">
      {/* Join Code */}
      <JoinCodeSection missionId={missionId} />

      {/* Pending join requests */}
      {canManage && joinRequests.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Pending Requests ({joinRequests.length})
          </label>
          <div className="space-y-2">
            {joinRequests.map((jr) => (
              <JoinRequestCard key={jr.id} jr={jr} missionId={missionId} groups={groups} myRole={myMissionRole} />
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Members ({members.length})
        </label>
        <div className="space-y-1">
          {members.map((m) => (
            <MemberRow key={m.user_id} member={m} missionId={missionId} groups={groups} onlineUsers={onlineUsers} myRole={myMissionRole} />
          ))}
        </div>
      </div>

      {/* Online users */}
      {onlineUsers.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Online ({onlineUsers.length})
          </label>
          <div className="flex flex-wrap gap-1">
            {onlineUsers.map((u) => (
              <span key={u.id} className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
                ● {u.username}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Shows the join code for the team (gesamtlead only) */
function JoinCodeSection({ missionId }) {
  const { myMissionRole } = useMissionStore();
  const [joinCode, setJoinCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/missions/${missionId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setJoinCode(data.join_code);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (myMissionRole !== 'gesamtlead') return null;

  return (
    <div className="bg-krt-bg/80 rounded-lg p-3">
      <label className="text-xs text-gray-500 block mb-1">Join Code</label>
      {joinCode ? (
        <div className="flex items-center gap-2">
          <code className="text-lg font-mono font-bold text-krt-accent tracking-wider">{joinCode}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(joinCode); toast.success('Code copied!'); }}
            className="text-xs text-gray-400 hover:text-white"
          >
            📋 Copy
          </button>
        </div>
      ) : (
        <button
          onClick={fetchCode}
          disabled={loading}
          className="text-sm text-krt-accent hover:text-blue-400"
        >
          {loading ? 'Loading…' : 'Show join code'}
        </button>
      )}
      <p className="text-[10px] text-gray-600 mt-1">Share this code so others can request to join.</p>
    </div>
  );
}

/** Card for a pending join request */
function JoinRequestCard({ jr, missionId, groups, myRole }) {
  const [selectedRole, setSelectedRole] = useState('teamlead');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const { removeJoinRequest, setMembers, members } = useMissionStore();

  const handleAccept = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${missionId}/requests/${jr.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mission_role: selectedRole,
          assigned_group_ids: selectedGroups,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed');
      }
      removeJoinRequest(jr.id);
      // Refetch members
      const membersRes = await fetch(`/api/members/${missionId}/members`, { credentials: 'include' });
      if (membersRes.ok) setMembers(await membersRes.json());
      toast.success(`${jr.username} accepted as ${ROLE_LABELS[selectedRole]?.label}`);
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await fetch(`/api/members/${missionId}/requests/${jr.id}/decline`, {
        method: 'POST',
        credentials: 'include',
      });
      removeJoinRequest(jr.id);
      toast.success('Request declined');
    } catch {
      toast.error('Failed to decline');
    }
    setBusy(false);
  };

  const toggleGroup = (gId) => {
    setSelectedGroups((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };

  const availableRoles = myRole === 'gesamtlead'
    ? ['gesamtlead', 'gruppenlead', 'teamlead']
    : ['teamlead']; // gruppenlead can only assign teamlead

  return (
    <div className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-white">{jr.username}</span>
          {jr.message && <p className="text-xs text-gray-400 mt-0.5">{jr.message}</p>}
        </div>
        <span className="text-[10px] text-gray-600">{new Date(jr.created_at).toLocaleString()}</span>
      </div>

      {/* Role selection */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Role:</label>
        {availableRoles.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRole(r)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedRole === r
                ? 'text-white'
                : 'text-gray-400 hover:text-white bg-krt-panel border border-krt-border'
            }`}
            style={selectedRole === r ? { backgroundColor: ROLE_LABELS[r].color } : {}}
          >
            {ROLE_LABELS[r].label}
          </button>
        ))}
      </div>

      {/* Group assignment (for gruppenlead / teamlead) */}
      {(selectedRole === 'gruppenlead' || selectedRole === 'teamlead') && groups.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Assign to {selectedRole === 'teamlead' ? 'group' : 'groups'}:
          </label>
          <div className="flex flex-wrap gap-1">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  if (selectedRole === 'teamlead') {
                    setSelectedGroups([g.id]); // teamlead gets exactly one
                  } else {
                    toggleGroup(g.id);
                  }
                }}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  selectedGroups.includes(g.id)
                    ? 'text-white border border-transparent'
                    : 'text-gray-400 bg-krt-panel border border-krt-border hover:text-white'
                }`}
                style={selectedGroups.includes(g.id) ? { backgroundColor: g.color } : {}}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Accept / Decline buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={busy}
          className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
        >
          ✓ Accept
        </button>
        <button
          onClick={handleDecline}
          disabled={busy}
          className="bg-red-600/30 hover:bg-red-600/50 text-red-400 text-xs px-3 py-1 rounded disabled:opacity-50"
        >
          ✕ Decline
        </button>
      </div>
    </div>
  );
}

/** Single member row with role editing */
function MemberRow({ member, missionId, groups, onlineUsers, myRole }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(member.mission_role || 'teamlead');
  const [assignedGroups, setAssignedGroups] = useState(member.assigned_group_ids || []);
  const [busy, setBusy] = useState(false);
  const { updateMember, removeMember, setMembers, members } = useMissionStore();

  const isOnline = onlineUsers.some((u) => u.id === member.user_id);
  const canEdit = myRole === 'gesamtlead' || (myRole === 'gruppenlead' && member.mission_role === 'teamlead');

  const handleSave = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${missionId}/members/${member.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_role: role, assigned_group_ids: assignedGroups }),
      });
      if (!res.ok) throw new Error('Failed');
      updateMember({ user_id: member.user_id, mission_role: role, assigned_group_ids: assignedGroups });
      setEditing(false);
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
    setBusy(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${member.username} from the mission?`)) return;
    try {
      await fetch(`/api/members/${missionId}/members/${member.user_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      removeMember(member.user_id);
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const toggleGroup = (gId) => {
    setAssignedGroups((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };

  return (
    <div className="bg-krt-bg/50 rounded-lg p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
          <span className="text-sm text-white">{member.username}</span>
          <RoleBadge role={member.mission_role || 'teamlead'} />
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <button onClick={() => setEditing(!editing)} className="text-xs text-gray-400 hover:text-krt-accent">
              ✏️
            </button>
            {myRole === 'gesamtlead' && (
              <button onClick={handleRemove} className="text-xs text-gray-400 hover:text-red-400">
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Assigned groups display */}
      {(member.assigned_group_ids || []).length > 0 && !editing && (
        <div className="flex flex-wrap gap-1 mt-1">
          {member.assigned_group_ids.map((gId) => {
            const g = groups.find((gr) => gr.id === gId);
            return g ? (
              <span key={gId} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: g.color + '30', color: g.color }}>
                {g.name}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Edit panel */}
      {editing && canEdit && (
        <div className="mt-2 space-y-2 border-t border-krt-border pt-2">
          <div className="flex items-center gap-1">
            {(myRole === 'gesamtlead' ? ['gesamtlead', 'gruppenlead', 'teamlead'] : ['teamlead']).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  role === r ? 'text-white' : 'text-gray-400 bg-krt-panel border border-krt-border hover:text-white'
                }`}
                style={role === r ? { backgroundColor: ROLE_LABELS[r].color } : {}}
              >
                {ROLE_LABELS[r].label}
              </button>
            ))}
          </div>
          {(role === 'gruppenlead' || role === 'teamlead') && groups.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    if (role === 'teamlead') setAssignedGroups([g.id]);
                    else toggleGroup(g.id);
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    assignedGroups.includes(g.id)
                      ? 'text-white border border-transparent'
                      : 'text-gray-400 bg-krt-panel border border-krt-border'
                  }`}
                  style={assignedGroups.includes(g.id) ? { backgroundColor: g.color } : {}}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy} className="bg-krt-accent text-white text-xs px-3 py-1 rounded">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 text-xs px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
