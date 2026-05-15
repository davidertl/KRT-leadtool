import React, { useState, useEffect, useCallback } from 'react';
import { useMissionStore } from '../stores/missionStore';

const THREAT_ORDER = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
const THREAT_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', none: '#6b7280' };
const IFF_COLORS = { hostile: '#ef4444', neutral: '#eab308', unknown: '#a78bfa', friendly: '#22c55e' };
const BATTLE_ROLES = ['assault', 'defense', 'reserve', 'support', 'recon', 'unassigned'];
const ROLE_COLORS = { assault: '#ef4444', defense: '#3b82f6', reserve: '#eab308', support: '#22c55e', recon: '#a78bfa', unassigned: '#4b5563' };
const VECTOR_TYPES = ['attack', 'defense', 'fallback', 'support', 'recon'];
const VECTOR_TYPE_COLORS = { attack: '#ef4444', defense: '#3b82f6', fallback: '#eab308', support: '#22c55e', recon: '#a78bfa' };
const STATUS_STYLES = {
  planning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  active: 'text-green-400 bg-green-400/10 border-green-400/30',
  complete: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  aborted: 'text-red-400 bg-red-400/10 border-red-400/30',
};

function ReadinessBar({ value, color = '#3b82f6' }) {
  const pct = Math.max(0, Math.min(100, value ?? 100));
  const barColor = pct < 25 ? '#ef4444' : pct < 60 ? '#eab308' : color;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-[10px] text-gray-400 w-7 text-right">{pct}%</span>
    </div>
  );
}

function UnitReadinessRow({ unit }) {
  const avg = Math.round(((unit.fuel ?? 100) + (unit.ammo ?? 100) + (unit.hull ?? 100)) / 3);
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[11px] text-gray-300 truncate w-28">{unit.callsign || unit.name}</span>
      <div className="flex-1 grid grid-cols-3 gap-1">
        <ReadinessBar value={unit.fuel} color="#3b82f6" />
        <ReadinessBar value={unit.ammo} color="#ef4444" />
        <ReadinessBar value={unit.hull} color="#22c55e" />
      </div>
      <span className={`text-[10px] font-bold w-7 text-right ${avg < 50 ? 'text-red-400' : avg < 75 ? 'text-yellow-400' : 'text-green-400'}`}>
        {avg}%
      </span>
    </div>
  );
}

/* ─── Tab: Fleet Readiness ───────────────────────────────── */
function ReadinessTab({ missionId }) {
  const { units, groups } = useMissionStore();
  const missionUnits = units.filter((u) => u.unit_type !== 'person');

  const byGroup = groups.map((g) => ({
    group: g,
    units: missionUnits.filter((u) => u.group_id === g.id),
  }));
  const ungrouped = missionUnits.filter((u) => !u.group_id);

  function groupReadiness(unitList) {
    if (!unitList.length) return 0;
    const avg = unitList.reduce((s, u) => s + Math.round(((u.fuel ?? 100) + (u.ammo ?? 100) + (u.hull ?? 100)) / 3), 0);
    return Math.round(avg / unitList.length);
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500 px-1 sticky top-0 bg-krt-panel pb-1">
        <span>Unit</span>
        <span className="text-center">Fuel / Ammo / Hull</span>
        <span className="text-right">Avg</span>
      </div>

      {byGroup.map(({ group, units: gUnits }) => {
        const readiness = groupReadiness(gUnits);
        return (
          <div key={group.id} className="border border-krt-border rounded">
            <div className="flex items-center gap-2 px-2 py-1 bg-krt-border/20">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#3b82f6' }} />
              <span className="text-xs font-medium text-gray-200 flex-1 truncate">{group.name}</span>
              {group.battle_role && group.battle_role !== 'unassigned' && (
                <span className="text-[9px] px-1 rounded" style={{ color: ROLE_COLORS[group.battle_role], backgroundColor: ROLE_COLORS[group.battle_role] + '22' }}>
                  {group.battle_role.toUpperCase()}
                </span>
              )}
              <span className={`text-[10px] font-bold ${readiness < 50 ? 'text-red-400' : readiness < 75 ? 'text-yellow-400' : 'text-green-400'}`}>
                {gUnits.length > 0 ? `${readiness}%` : '—'}
              </span>
            </div>
            {gUnits.length > 0 && (
              <div className="px-2 py-1 space-y-0.5">
                {gUnits.map((u) => <UnitReadinessRow key={u.id} unit={u} />)}
              </div>
            )}
            {gUnits.length === 0 && (
              <div className="px-2 py-1 text-[11px] text-gray-600 italic">No units assigned</div>
            )}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div className="border border-krt-border rounded">
          <div className="flex items-center gap-2 px-2 py-1 bg-krt-border/20">
            <span className="text-xs text-gray-400 flex-1">Ungrouped</span>
          </div>
          <div className="px-2 py-1 space-y-0.5">
            {ungrouped.map((u) => <UnitReadinessRow key={u.id} unit={u} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Threat Board ──────────────────────────────────── */
function ThreatBoardTab({ missionId }) {
  const { contacts, focusPosition } = useMissionStore();
  const activeContacts = contacts.filter((c) => c.is_active);
  const sorted = [...activeContacts].sort((a, b) => {
    const tDiff = (THREAT_ORDER[a.threat] ?? 9) - (THREAT_ORDER[b.threat] ?? 9);
    if (tDiff !== 0) return tDiff;
    if (a.iff === 'hostile' && b.iff !== 'hostile') return -1;
    if (b.iff === 'hostile' && a.iff !== 'hostile') return 1;
    return 0;
  });

  const hostiles = sorted.filter((c) => c.iff === 'hostile');
  const others = sorted.filter((c) => c.iff !== 'hostile');

  function ContactRow({ contact }) {
    const threatColor = THREAT_COLORS[contact.threat] || '#6b7280';
    const iffColor = IFF_COLORS[contact.iff] || '#6b7280';
    return (
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-krt-border/20 rounded text-left"
        onClick={() => focusPosition({ x: contact.pos_x, y: contact.pos_y, z: contact.pos_z })}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: iffColor }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-200 truncate">{contact.name || `${contact.iff} contact`}</div>
          <div className="text-[10px] text-gray-500">
            {contact.ship_type || 'Unknown type'}
            {contact.count > 1 && <span className="ml-1 text-gray-400">×{contact.count}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold px-1 rounded" style={{ color: threatColor, backgroundColor: threatColor + '22' }}>
            {contact.threat?.toUpperCase() || 'NONE'}
          </span>
          <span className="text-[9px]" style={{ color: iffColor }}>{contact.iff?.toUpperCase()}</span>
        </div>
      </button>
    );
  }

  if (sorted.length === 0) {
    return <div className="text-center text-gray-500 text-sm py-8">No active contacts</div>;
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {hostiles.length > 0 && (
        <div>
          <div className="text-[10px] text-red-400 font-bold px-1 py-0.5 uppercase tracking-wider">
            Hostile ({hostiles.length})
          </div>
          {hostiles.map((c) => <ContactRow key={c.id} contact={c} />)}
        </div>
      )}
      {others.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-bold px-1 py-0.5 uppercase tracking-wider mt-1">
            Other ({others.length})
          </div>
          {others.map((c) => <ContactRow key={c.id} contact={c} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Group Battle Roles ────────────────────────────── */
function GroupRolesTab({ missionId }) {
  const { groups, myMissionRole } = useMissionStore();
  const canEdit = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';
  const [saving, setSaving] = useState(null);

  async function setRole(group_id, battle_role) {
    setSaving(group_id);
    try {
      await fetch('/api/battle-plans/group-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_id: missionId, roles: [{ group_id, battle_role }] }),
      });
    } catch (e) {
      console.error('Failed to set battle role', e);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      <div className="text-[11px] text-gray-500 px-1 pb-1">
        Assign tactical roles to groups for the upcoming engagement.
      </div>
      {groups.map((group) => (
        <div key={group.id} className="border border-krt-border rounded px-2 py-1.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#3b82f6' }} />
            <span className="text-xs text-gray-200 flex-1 truncate">{group.name}</span>
            <span className="text-[10px] text-gray-500">{group.class_type}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {BATTLE_ROLES.map((role) => (
              <button
                key={role}
                disabled={!canEdit || saving === group.id}
                onClick={() => setRole(group.id, role)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  group.battle_role === role
                    ? 'font-bold border-transparent'
                    : 'border-krt-border/40 text-gray-500 hover:text-gray-300 hover:border-gray-500'
                } ${!canEdit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                style={group.battle_role === role ? { color: ROLE_COLORS[role], backgroundColor: ROLE_COLORS[role] + '33', borderColor: ROLE_COLORS[role] + '66' } : {}}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <div className="text-center text-gray-500 text-sm py-8">No groups in this mission</div>
      )}
    </div>
  );
}

/* ─── Tab: Attack Vectors ────────────────────────────────── */
function VectorsTab({ missionId }) {
  const {
    battlePlans, battlePlanVectors, activeBattlePlanId,
    setActiveBattlePlanId, setBattlePlanVectors, myMissionRole,
    addBattlePlan, setBattlePlans,
  } = useMissionStore();

  const canEdit = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';
  const [newPlanName, setNewPlanName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingVector, setAddingVector] = useState(false);
  const [vectorForm, setVectorForm] = useState({
    name: '', vector_type: 'attack', color: '#ef4444',
    start_x: 0, start_y: 0, start_z: 0, end_x: 0, end_y: 0, end_z: 0, notes: '',
  });

  const activePlan = battlePlans.find((p) => p.id === activeBattlePlanId);
  const vectors = (activeBattlePlanId ? battlePlanVectors[activeBattlePlanId] : null) || [];

  // Load plans on mount
  useEffect(() => {
    fetch(`/api/battle-plans?mission_id=${missionId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((plans) => setBattlePlans(Array.isArray(plans) ? plans : []))
      .catch(() => {});
  }, [missionId]);

  // Load vectors when active plan changes
  useEffect(() => {
    if (!activeBattlePlanId) return;
    if (battlePlanVectors[activeBattlePlanId]) return; // already loaded
    fetch(`/api/battle-plans/${activeBattlePlanId}/vectors`, { credentials: 'include' })
      .then((r) => r.json())
      .then((vecs) => setBattlePlanVectors(activeBattlePlanId, Array.isArray(vecs) ? vecs : []))
      .catch(() => {});
  }, [activeBattlePlanId]);

  async function createPlan() {
    if (!newPlanName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch('/api/battle-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mission_id: missionId, name: newPlanName.trim() }),
      });
      const plan = await r.json();
      if (plan.id) {
        addBattlePlan(plan);
        setActiveBattlePlanId(plan.id);
        setNewPlanName('');
      }
    } catch (e) {
      console.error('Failed to create plan', e);
    } finally {
      setCreating(false);
    }
  }

  async function setPlanStatus(planId, status) {
    await fetch(`/api/battle-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
  }

  async function addVector() {
    if (!activeBattlePlanId || !vectorForm.name.trim()) return;
    setAddingVector(true);
    try {
      const r = await fetch(`/api/battle-plans/${activeBattlePlanId}/vectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...vectorForm }),
      });
      if (r.ok) {
        const vec = await r.json();
        setBattlePlanVectors(activeBattlePlanId, [...vectors, vec]);
        setVectorForm({ name: '', vector_type: 'attack', color: '#ef4444', start_x: 0, start_y: 0, start_z: 0, end_x: 0, end_y: 0, end_z: 0, notes: '' });
      }
    } catch (e) {
      console.error('Failed to add vector', e);
    } finally {
      setAddingVector(false);
    }
  }

  async function deleteVector(vectorId) {
    await fetch(`/api/battle-plans/${activeBattlePlanId}/vectors/${vectorId}`, { method: 'DELETE', credentials: 'include' });
    setBattlePlanVectors(activeBattlePlanId, vectors.filter((v) => v.id !== vectorId));
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {/* Plan selector */}
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Battle Plans</div>
        <div className="flex flex-wrap gap-1">
          {battlePlans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setActiveBattlePlanId(activeBattlePlanId === plan.id ? null : plan.id)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                activeBattlePlanId === plan.id
                  ? 'bg-krt-accent/20 text-krt-accent border-krt-accent/40'
                  : 'text-gray-400 border-krt-border hover:text-gray-200'
              }`}
            >
              {plan.name}
              <span className={`ml-1 text-[9px] px-1 rounded border ${STATUS_STYLES[plan.status] || STATUS_STYLES.planning}`}>
                {plan.status}
              </span>
            </button>
          ))}
        </div>

        {canEdit && (
          <div className="flex gap-1 mt-1">
            <input
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPlan()}
              placeholder="New plan name…"
              className="flex-1 bg-krt-border/30 text-gray-200 text-xs rounded px-2 py-1 border border-krt-border focus:border-krt-accent outline-none"
            />
            <button
              onClick={createPlan}
              disabled={creating || !newPlanName.trim()}
              className="text-xs px-2 py-1 rounded bg-krt-accent/20 text-krt-accent border border-krt-accent/30 hover:bg-krt-accent/30 disabled:opacity-40"
            >
              + Plan
            </button>
          </div>
        )}
      </div>

      {/* Active plan status controls */}
      {activePlan && canEdit && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-gray-500">Status:</span>
          {['planning', 'active', 'complete', 'aborted'].map((s) => (
            <button
              key={s}
              onClick={() => setPlanStatus(activePlan.id, s)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                activePlan.status === s ? STATUS_STYLES[s] : 'text-gray-600 border-krt-border hover:text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Vectors for active plan */}
      {activeBattlePlanId && (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
            Vectors {vectors.length > 0 && `(${vectors.length})`}
          </div>

          {vectors.map((vec) => (
            <div key={vec.id} className="flex items-start gap-2 px-2 py-1.5 rounded border border-krt-border/50">
              <div className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: vec.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-200">{vec.name}</div>
                <div className="text-[10px] text-gray-500">
                  <span style={{ color: VECTOR_TYPE_COLORS[vec.vector_type] }}>{vec.vector_type}</span>
                  {' · '}
                  ({Math.round(vec.start_x)}, {Math.round(vec.start_y)}, {Math.round(vec.start_z)})
                  {' → '}
                  ({Math.round(vec.end_x)}, {Math.round(vec.end_y)}, {Math.round(vec.end_z)})
                </div>
                {vec.notes && <div className="text-[10px] text-gray-500 italic mt-0.5">{vec.notes}</div>}
              </div>
              {canEdit && (
                <button
                  onClick={() => deleteVector(vec.id)}
                  className="text-gray-600 hover:text-red-400 text-[10px] flex-shrink-0 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {vectors.length === 0 && (
            <div className="text-center text-gray-600 text-xs py-2">No vectors defined</div>
          )}

          {/* Add vector form */}
          {canEdit && (
            <div className="border border-krt-border rounded p-2 mt-1 space-y-1.5">
              <div className="text-[10px] text-gray-500 font-bold uppercase">Add Vector</div>
              <input
                value={vectorForm.name}
                onChange={(e) => setVectorForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Vector name (e.g. Alpha Strike)"
                className="w-full bg-krt-border/30 text-gray-200 text-xs rounded px-2 py-1 border border-krt-border focus:border-krt-accent outline-none"
              />
              <div className="flex gap-1">
                <select
                  value={vectorForm.vector_type}
                  onChange={(e) => setVectorForm((f) => ({ ...f, vector_type: e.target.value, color: VECTOR_TYPE_COLORS[e.target.value] || '#ef4444' }))}
                  className="flex-1 bg-krt-border/30 text-gray-200 text-xs rounded px-1 py-1 border border-krt-border focus:border-krt-accent outline-none"
                >
                  {VECTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">Color:</span>
                  <input
                    type="color"
                    value={vectorForm.color}
                    onChange={(e) => setVectorForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-7 h-6 rounded cursor-pointer border border-krt-border bg-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {['start_x', 'start_y', 'start_z'].map((k) => (
                  <input key={k} type="number" value={vectorForm[k]}
                    onChange={(e) => setVectorForm((f) => ({ ...f, [k]: parseFloat(e.target.value) || 0 }))}
                    placeholder={k.replace('start_', 'S ')}
                    className="bg-krt-border/30 text-gray-200 text-xs rounded px-1 py-0.5 border border-krt-border focus:border-krt-accent outline-none w-full"
                  />
                ))}
                {['end_x', 'end_y', 'end_z'].map((k) => (
                  <input key={k} type="number" value={vectorForm[k]}
                    onChange={(e) => setVectorForm((f) => ({ ...f, [k]: parseFloat(e.target.value) || 0 }))}
                    placeholder={k.replace('end_', 'E ')}
                    className="bg-krt-border/30 text-gray-200 text-xs rounded px-1 py-0.5 border border-krt-border focus:border-krt-accent outline-none w-full"
                  />
                ))}
              </div>
              <input
                value={vectorForm.notes}
                onChange={(e) => setVectorForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="w-full bg-krt-border/30 text-gray-200 text-xs rounded px-2 py-1 border border-krt-border focus:border-krt-accent outline-none"
              />
              <button
                onClick={addVector}
                disabled={addingVector || !vectorForm.name.trim()}
                className="w-full text-xs py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
              >
                {addingVector ? 'Adding…' : '+ Add Vector'}
              </button>
            </div>
          )}
        </div>
      )}

      {!activeBattlePlanId && battlePlans.length > 0 && (
        <div className="text-center text-gray-500 text-xs py-4">Select a battle plan above to manage vectors</div>
      )}
      {!activeBattlePlanId && battlePlans.length === 0 && (
        <div className="text-center text-gray-500 text-xs py-4">No battle plans yet. Create one above.</div>
      )}
    </div>
  );
}

/* ─── Main Panel ─────────────────────────────────────────── */
export default function BattleplanPanel({ missionId }) {
  const [tab, setTab] = useState('readiness');

  const TABS = [
    { id: 'readiness', label: 'Fleet Readiness', icon: '⚡' },
    { id: 'threats',   label: 'Threat Board',    icon: '🎯' },
    { id: 'roles',     label: 'Battle Roles',    icon: '🛡️' },
    { id: 'vectors',   label: 'Vectors',         icon: '↗️' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-krt-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors border-b-2 ${
              tab === t.id
                ? 'border-krt-accent text-krt-accent'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden p-2">
        {tab === 'readiness' && <ReadinessTab missionId={missionId} />}
        {tab === 'threats'   && <ThreatBoardTab missionId={missionId} />}
        {tab === 'roles'     && <GroupRolesTab missionId={missionId} />}
        {tab === 'vectors'   && <VectorsTab missionId={missionId} />}
      </div>
    </div>
  );
}
