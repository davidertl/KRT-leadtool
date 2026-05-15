import React, { useState, useEffect } from 'react';
import { useMissionStore } from '../stores/missionStore';

const THREAT_ORDER = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
const THREAT_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6', none: '#6b7280' };
const IFF_COLORS = { hostile: '#ef4444', neutral: '#eab308', unknown: '#a78bfa', friendly: '#22c55e' };
const BATTLE_ROLES = ['assault', 'defense', 'reserve', 'support', 'recon', 'unassigned'];
const ROLE_COLORS = { assault: '#ef4444', defense: '#3b82f6', reserve: '#eab308', support: '#22c55e', recon: '#a78bfa', unassigned: '#4b5563' };
const ROLE_DESC = { assault: 'Primary strike force', defense: 'Hold & protect', reserve: 'Standby / QRF', support: 'Logistics & repair', recon: 'Scout ahead', unassigned: 'No role set' };
const VECTOR_TYPES = ['attack', 'defense', 'fallback', 'support', 'recon'];
const VECTOR_TYPE_COLORS = { attack: '#ef4444', defense: '#3b82f6', fallback: '#eab308', support: '#22c55e', recon: '#a78bfa' };
const VECTOR_TYPE_DESC = { attack: 'Offensive strike', defense: 'Hold position', fallback: 'Withdrawal route', support: 'Support path', recon: 'Scout route' };
const STATUS_STYLES = {
  planning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  active:   'text-green-400 bg-green-400/10 border-green-400/30',
  complete: 'text-gray-400 bg-gray-400/10 border-gray-400/30',
  aborted:  'text-red-400 bg-red-400/10 border-red-400/30',
};

/** Format large game-space coordinates readably: 12300000 → "12.3M" */
function fmtCoord(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

function ReadinessBar({ value, label, color }) {
  const pct = Math.max(0, Math.min(100, value ?? 100));
  const barColor = pct < 25 ? '#ef4444' : pct < 60 ? '#eab308' : color;
  return (
    <div title={`${label}: ${pct}%`}>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function UnitReadinessRow({ unit }) {
  const avg = Math.round(((unit.fuel ?? 100) + (unit.ammo ?? 100) + (unit.hull ?? 100)) / 3);
  const statusColor = avg < 50 ? 'text-red-400' : avg < 75 ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="flex items-center gap-2 py-0.5" title={`${unit.name} — Fuel: ${unit.fuel ?? 100}%  Ammo: ${unit.ammo ?? 100}%  Hull: ${unit.hull ?? 100}%`}>
      <span className="text-[11px] text-gray-300 truncate w-28">{unit.callsign || unit.name}</span>
      <div className="flex-1 grid grid-cols-3 gap-1">
        <ReadinessBar value={unit.fuel}  label="Fuel"  color="#3b82f6" />
        <ReadinessBar value={unit.ammo}  label="Ammo"  color="#ef4444" />
        <ReadinessBar value={unit.hull}  label="Hull"  color="#22c55e" />
      </div>
      <span className={`text-[10px] font-bold w-7 text-right ${statusColor}`}>{avg}%</span>
    </div>
  );
}

/* ─── Tab: Fleet Readiness ───────────────────────────────── */
function ReadinessTab() {
  const { units, groups } = useMissionStore();
  const missionUnits = units.filter((u) => u.unit_type !== 'person');

  const byGroup = groups.map((g) => ({
    group: g,
    units: missionUnits.filter((u) => u.group_id === g.id),
  }));
  const ungrouped = missionUnits.filter((u) => !u.group_id);

  function groupReadiness(unitList) {
    if (!unitList.length) return null;
    const sum = unitList.reduce((s, u) => s + Math.round(((u.fuel ?? 100) + (u.ammo ?? 100) + (u.hull ?? 100)) / 3), 0);
    return Math.round(sum / unitList.length);
  }

  if (missionUnits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4 py-8">
        <span className="text-3xl">🚀</span>
        <p className="text-sm text-gray-400 font-medium">No ships assigned yet</p>
        <p className="text-xs text-gray-600">Open <strong className="text-gray-400">Units</strong> from the menu bar to add ships and assign them to groups. Fleet readiness will show here once ships are added.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pr-1">
      {/* Legend */}
      <div className="flex items-center gap-3 px-1 pb-0.5 border-b border-krt-border/40">
        <span className="text-[10px] text-gray-500 flex-1">Unit</span>
        <div className="flex gap-2 text-[9px]">
          <span className="flex items-center gap-0.5"><span className="w-2 h-1.5 rounded-sm bg-blue-500 inline-block" />Fuel</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-1.5 rounded-sm bg-red-500 inline-block" />Ammo</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-1.5 rounded-sm bg-green-500 inline-block" />Hull</span>
        </div>
        <span className="text-[10px] text-gray-500 w-7 text-right">Avg</span>
      </div>

      {byGroup.map(({ group, units: gUnits }) => {
        const readiness = groupReadiness(gUnits);
        const statusColor = readiness == null ? 'text-gray-500' : readiness < 50 ? 'text-red-400' : readiness < 75 ? 'text-yellow-400' : 'text-green-400';
        return (
          <div key={group.id} className="border border-krt-border rounded">
            <div className="flex items-center gap-2 px-2 py-1 bg-krt-border/20">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#3b82f6' }} />
              <span className="text-xs font-medium text-gray-200 flex-1 truncate">{group.name}</span>
              {group.battle_role && group.battle_role !== 'unassigned' && (
                <span
                  className="text-[9px] px-1 rounded font-bold"
                  style={{ color: ROLE_COLORS[group.battle_role], backgroundColor: ROLE_COLORS[group.battle_role] + '22' }}
                  title={ROLE_DESC[group.battle_role]}
                >
                  {group.battle_role.toUpperCase()}
                </span>
              )}
              <span className={`text-[10px] font-bold w-8 text-right ${statusColor}`}>
                {readiness != null ? `${readiness}%` : '—'}
              </span>
            </div>
            {gUnits.length > 0 ? (
              <div className="px-2 py-1 space-y-0.5">
                {gUnits.map((u) => <UnitReadinessRow key={u.id} unit={u} />)}
              </div>
            ) : (
              <div className="px-2 py-1 text-[11px] text-gray-600 italic">No ships in this group</div>
            )}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div className="border border-krt-border rounded">
          <div className="flex items-center gap-2 px-2 py-1 bg-krt-border/20">
            <span className="text-xs text-gray-400 flex-1">Ungrouped ships</span>
          </div>
          <div className="px-2 py-1 space-y-0.5">
            {ungrouped.map((u) => <UnitReadinessRow key={u.id} unit={u} />)}
          </div>
        </div>
      )}

      {groups.length === 0 && ungrouped.length === 0 && (
        <div className="text-center text-gray-600 text-xs py-4">No groups created yet</div>
      )}
    </div>
  );
}

/* ─── Tab: Threat Board ──────────────────────────────────── */
function ThreatBoardTab() {
  const { contacts, focusPosition } = useMissionStore();
  const activeContacts = contacts.filter((c) => c.is_active);
  const sorted = [...activeContacts].sort((a, b) => {
    const tDiff = (THREAT_ORDER[a.threat] ?? 9) - (THREAT_ORDER[b.threat] ?? 9);
    if (tDiff !== 0) return tDiff;
    if (a.iff === 'hostile' && b.iff !== 'hostile') return -1;
    if (b.iff === 'hostile' && a.iff !== 'hostile') return 1;
    return 0;
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4 py-8">
        <span className="text-3xl">📡</span>
        <p className="text-sm text-gray-400 font-medium">No active contacts</p>
        <p className="text-xs text-gray-600">Use <strong className="text-gray-400">SPOTREP</strong> from the menu bar to report enemy contacts. Hostile contacts sorted by threat level appear here.</p>
      </div>
    );
  }

  const hostiles = sorted.filter((c) => c.iff === 'hostile');
  const others = sorted.filter((c) => c.iff !== 'hostile');

  function ContactRow({ contact }) {
    const threatColor = THREAT_COLORS[contact.threat] || '#6b7280';
    const iffColor = IFF_COLORS[contact.iff] || '#6b7280';
    return (
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-krt-border/20 rounded text-left group"
        onClick={() => focusPosition({ x: contact.pos_x, y: contact.pos_y, z: contact.pos_z })}
        title="Click to focus camera on this contact"
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: iffColor }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-200 truncate">{contact.name || `${contact.iff} contact`}</div>
          <div className="text-[10px] text-gray-500">
            {contact.ship_type || 'Unknown vessel'}
            {contact.count > 1 && <span className="ml-1 text-gray-400">× {contact.count}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-[10px] font-bold px-1 rounded" style={{ color: threatColor, backgroundColor: threatColor + '22' }}>
            {contact.threat?.toUpperCase() || 'NONE'}
          </span>
          <span className="text-[9px] opacity-60 group-hover:opacity-100 transition-opacity">▶ focus</span>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {hostiles.length > 0 && (
        <section>
          <div className="text-[10px] text-red-400 font-bold px-1 py-0.5 uppercase tracking-wider">
            ⚠ Hostiles ({hostiles.length})
          </div>
          {hostiles.map((c) => <ContactRow key={c.id} contact={c} />)}
        </section>
      )}
      {others.length > 0 && (
        <section>
          <div className="text-[10px] text-gray-500 font-bold px-1 py-0.5 uppercase tracking-wider mt-1">
            Other contacts ({others.length})
          </div>
          {others.map((c) => <ContactRow key={c.id} contact={c} />)}
        </section>
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
    } finally {
      setSaving(null);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4 py-8">
        <span className="text-3xl">👥</span>
        <p className="text-sm text-gray-400 font-medium">No groups yet</p>
        <p className="text-xs text-gray-600">Open <strong className="text-gray-400">Groups</strong> from the menu bar to create fleet groups (e.g. "Alpha Squadron"). Then assign battle roles here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {!canEdit && (
        <div className="text-[11px] text-gray-600 bg-krt-border/10 rounded px-2 py-1.5 mb-1">
          Read-only — only Gesamtlead or Gruppenlead can assign battle roles.
        </div>
      )}
      <div className="text-[11px] text-gray-500 px-1 pb-1">
        Tap a role to assign it. Roles are visible to all mission members.
      </div>
      {groups.map((group) => (
        <div key={group.id} className="border border-krt-border rounded px-2 py-1.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#3b82f6' }} />
            <span className="text-xs text-gray-200 flex-1 truncate font-medium">{group.name}</span>
            {saving === group.id && <span className="text-[10px] text-gray-500 animate-pulse">Saving…</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {BATTLE_ROLES.map((role) => {
              const isActive = group.battle_role === role;
              return (
                <button
                  key={role}
                  disabled={!canEdit || saving === group.id}
                  onClick={() => setRole(group.id, role)}
                  title={ROLE_DESC[role]}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    isActive ? 'font-bold border-transparent' : 'border-krt-border/40 text-gray-500 hover:text-gray-300 hover:border-gray-500'
                  } ${!canEdit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={isActive ? { color: ROLE_COLORS[role], backgroundColor: ROLE_COLORS[role] + '33', borderColor: ROLE_COLORS[role] + '66' } : {}}
                >
                  {role}
                </button>
              );
            })}
          </div>
          {group.battle_role && group.battle_role !== 'unassigned' && (
            <div className="text-[10px] text-gray-600 mt-0.5">{ROLE_DESC[group.battle_role]}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Tab: Attack Vectors ────────────────────────────────── */

const EMPTY_VECTOR_FORM = { name: '', vector_type: 'attack', color: '#ef4444', start_x: 0, start_y: 0, start_z: 0, end_x: 0, end_y: 0, end_z: 0, notes: '' };

function CoordPicker({ label, xKey, yKey, zKey, form, setForm, units, contacts }) {
  const [open, setOpen] = useState(false);

  const options = [
    ...units.map((u) => ({ label: `Ship: ${u.callsign || u.name}`, x: u.pos_x, y: u.pos_y, z: u.pos_z })),
    ...contacts.filter((c) => c.is_active).map((c) => ({ label: `Contact: ${c.name || c.iff}`, x: c.pos_x, y: c.pos_y, z: c.pos_z })),
  ];

  function pick(x, y, z) {
    setForm((f) => ({ ...f, [xKey]: Math.round(x), [yKey]: Math.round(y), [zKey]: Math.round(z) }));
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px] text-gray-500 flex-1 font-medium">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[9px] text-krt-accent/80 hover:text-krt-accent border border-krt-accent/30 px-1 py-0.5 rounded transition-colors"
          title="Pick position from an existing unit or contact"
        >
          ⌖ Pick from map
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[xKey, yKey, zKey].map((k, i) => (
          <input
            key={k}
            type="number"
            value={form[k]}
            onChange={(e) => setForm((f) => ({ ...f, [k]: parseFloat(e.target.value) || 0 }))}
            placeholder={['X', 'Y', 'Z'][i]}
            className="bg-krt-border/30 text-gray-200 text-xs rounded px-1.5 py-1 border border-krt-border focus:border-krt-accent outline-none w-full"
          />
        ))}
      </div>
      <div className="text-[10px] text-gray-600 mt-0.5">
        {fmtCoord(form[xKey])}, {fmtCoord(form[yKey])}, {fmtCoord(form[zKey])}
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-krt-panel border border-krt-border rounded shadow-xl max-h-40 overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-[11px] text-gray-500 px-3 py-2">No units or contacts in mission yet</div>
          ) : (
            options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(opt.x, opt.y, opt.z)}
                className="w-full text-left px-3 py-1.5 hover:bg-krt-border/30 text-xs text-gray-300 flex items-center justify-between"
              >
                <span>{opt.label}</span>
                <span className="text-[10px] text-gray-500">{fmtCoord(opt.x)}, {fmtCoord(opt.y)}, {fmtCoord(opt.z)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function VectorsTab({ missionId }) {
  const {
    units, contacts,
    battlePlans, battlePlanVectors, activeBattlePlanId,
    setActiveBattlePlanId, setBattlePlanVectors, myMissionRole,
    addBattlePlan, setBattlePlans, updateBattlePlan,
  } = useMissionStore();

  const canEdit = myMissionRole === 'gesamtlead' || myMissionRole === 'gruppenlead';
  const [newPlanName, setNewPlanName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_VECTOR_FORM);

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
    if (!activeBattlePlanId || battlePlanVectors[activeBattlePlanId]) return;
    fetch(`/api/battle-plans/${activeBattlePlanId}/vectors`, { credentials: 'include' })
      .then((r) => r.json())
      .then((vecs) => setBattlePlanVectors(activeBattlePlanId, Array.isArray(vecs) ? vecs : []))
      .catch(() => {});
  }, [activeBattlePlanId]);

  // Auto-open add form when plan is selected and has no vectors
  useEffect(() => {
    if (activeBattlePlanId && vectors.length === 0 && canEdit) setShowAddForm(true);
  }, [activeBattlePlanId, vectors.length]);

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
        setShowAddForm(true);
      }
    } finally {
      setCreating(false);
    }
  }

  async function setPlanStatus(planId, status) {
    const r = await fetch(`/api/battle-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      const updated = await r.json();
      updateBattlePlan(updated);
    }
  }

  async function addVector() {
    if (!activeBattlePlanId || !form.name.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/battle-plans/${activeBattlePlanId}/vectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form }),
      });
      if (r.ok) {
        const vec = await r.json();
        setBattlePlanVectors(activeBattlePlanId, [...vectors, vec]);
        setForm(EMPTY_VECTOR_FORM);
        setShowAddForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteVector(vectorId) {
    await fetch(`/api/battle-plans/${activeBattlePlanId}/vectors/${vectorId}`, { method: 'DELETE', credentials: 'include' });
    setBattlePlanVectors(activeBattlePlanId, vectors.filter((v) => v.id !== vectorId));
  }

  const nonPersonUnits = units.filter((u) => u.unit_type !== 'person');

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pb-2">
      {/* ── Step 1: Pick or create a plan ── */}
      <section>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">
          Step 1 — Select a battle plan
        </div>
        {battlePlans.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {battlePlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setActiveBattlePlanId(activeBattlePlanId === plan.id ? null : plan.id)}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                  activeBattlePlanId === plan.id
                    ? 'bg-krt-accent/20 text-krt-accent border-krt-accent/40 font-medium'
                    : 'text-gray-400 border-krt-border hover:text-gray-200'
                }`}
              >
                {plan.name}
                <span className={`text-[9px] px-1 rounded border ml-0.5 ${STATUS_STYLES[plan.status] || STATUS_STYLES.planning}`}>
                  {plan.status}
                </span>
              </button>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex gap-1">
            <input
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPlan()}
              placeholder="Name new plan (e.g. Operation Anvil)…"
              className="flex-1 bg-krt-border/30 text-gray-200 text-xs rounded px-2 py-1 border border-krt-border focus:border-krt-accent outline-none"
            />
            <button
              onClick={createPlan}
              disabled={creating || !newPlanName.trim()}
              className="text-xs px-2 py-1 rounded bg-krt-accent/20 text-krt-accent border border-krt-accent/30 hover:bg-krt-accent/30 disabled:opacity-40 whitespace-nowrap"
            >
              + Create
            </button>
          </div>
        )}
        {!canEdit && battlePlans.length === 0 && (
          <div className="text-xs text-gray-600">No battle plans yet. A Gesamtlead must create one.</div>
        )}
      </section>

      {/* ── Active plan controls ── */}
      {activePlan && (
        <>
          <div className="border-t border-krt-border/40 pt-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">
              Step 2 — Set plan status
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { s: 'planning', hint: 'Still being drafted' },
                { s: 'active',   hint: 'Engagement in progress — vectors shown on map' },
                { s: 'complete', hint: 'Engagement finished' },
                { s: 'aborted',  hint: 'Plan was cancelled' },
              ].map(({ s, hint }) => (
                <button
                  key={s}
                  onClick={() => canEdit && setPlanStatus(activePlan.id, s)}
                  title={hint}
                  disabled={!canEdit}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    activePlan.status === s ? STATUS_STYLES[s] : 'text-gray-600 border-krt-border hover:text-gray-400'
                  } ${!canEdit ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {activePlan.status === 'active' && (
              <p className="text-[10px] text-green-400/70 mt-1">✓ Vectors from this plan are now visible on the 3D map</p>
            )}
          </div>

          {/* ── Vectors ── */}
          <div className="border-t border-krt-border/40 pt-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                Step 3 — Attack vectors {vectors.length > 0 && `(${vectors.length})`}
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="text-[10px] text-krt-accent hover:text-krt-accent/80 px-2 py-0.5 rounded border border-krt-accent/30 hover:bg-krt-accent/10 transition-colors"
                >
                  {showAddForm ? '✕ Cancel' : '+ Add vector'}
                </button>
              )}
            </div>

            {/* Add form */}
            {showAddForm && canEdit && (
              <div className="border border-krt-accent/20 rounded p-2 mb-2 space-y-2 bg-krt-accent/5">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Vector name (e.g. Alpha Strike, Bravo Flanking)"
                  className="w-full bg-krt-border/30 text-gray-200 text-xs rounded px-2 py-1 border border-krt-border focus:border-krt-accent outline-none"
                  autoFocus
                />
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
                    <select
                      value={form.vector_type}
                      onChange={(e) => setForm((f) => ({ ...f, vector_type: e.target.value, color: VECTOR_TYPE_COLORS[e.target.value] || '#ef4444' }))}
                      className="w-full bg-krt-border/30 text-gray-200 text-xs rounded px-1.5 py-1 border border-krt-border focus:border-krt-accent outline-none"
                    >
                      {VECTOR_TYPES.map((t) => (
                        <option key={t} value={t}>{t} — {VECTOR_TYPE_DESC[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Color</label>
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-9 h-7 rounded cursor-pointer border border-krt-border bg-transparent"
                    />
                  </div>
                </div>

                <CoordPicker
                  label="Start position"
                  xKey="start_x" yKey="start_y" zKey="start_z"
                  form={form} setForm={setForm}
                  units={nonPersonUnits} contacts={contacts.filter((c) => c.is_active)}
                />
                <CoordPicker
                  label="End position (arrow tip)"
                  xKey="end_x" yKey="end_y" zKey="end_z"
                  form={form} setForm={setForm}
                  units={nonPersonUnits} contacts={contacts.filter((c) => c.is_active)}
                />

                <input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes (briefing details, comms freq, etc.)"
                  className="w-full bg-krt-border/30 text-gray-200 text-xs rounded px-2 py-1 border border-krt-border focus:border-krt-accent outline-none"
                />
                <button
                  onClick={addVector}
                  disabled={submitting || !form.name.trim()}
                  className="w-full text-xs py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 transition-colors font-medium"
                >
                  {submitting ? 'Adding…' : '↗ Add vector to plan'}
                </button>
              </div>
            )}

            {/* Vector list */}
            {vectors.map((vec) => (
              <div key={vec.id} className="flex items-start gap-2 px-2 py-1.5 rounded border border-krt-border/50 mb-1">
                <div className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: vec.color }} title={vec.vector_type} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 font-medium">{vec.name}</div>
                  <div className="text-[10px] text-gray-500">
                    <span style={{ color: VECTOR_TYPE_COLORS[vec.vector_type] }}>{vec.vector_type}</span>
                    {' · '}
                    {fmtCoord(vec.start_x)}, {fmtCoord(vec.start_y)}, {fmtCoord(vec.start_z)}
                    {' → '}
                    {fmtCoord(vec.end_x)}, {fmtCoord(vec.end_y)}, {fmtCoord(vec.end_z)}
                  </div>
                  {vec.notes && <div className="text-[10px] text-gray-600 italic mt-0.5">{vec.notes}</div>}
                </div>
                {canEdit && (
                  <button
                    onClick={() => deleteVector(vec.id)}
                    className="text-gray-600 hover:text-red-400 text-[11px] flex-shrink-0 transition-colors px-1"
                    title="Remove this vector"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {vectors.length === 0 && !showAddForm && (
              <div className="text-center text-gray-600 text-xs py-3">
                No vectors yet.{canEdit && ' Click "+ Add vector" above to draw an attack line on the map.'}
              </div>
            )}
          </div>
        </>
      )}

      {!activeBattlePlanId && battlePlans.length > 0 && (
        <div className="text-center text-gray-600 text-xs py-4 border-t border-krt-border/40 pt-4">
          Select a plan above to view and manage its attack vectors.
        </div>
      )}
    </div>
  );
}

/* ─── Main Panel ─────────────────────────────────────────── */
export default function BattleplanPanel({ missionId }) {
  const [tab, setTab] = useState('readiness');

  const TABS = [
    { id: 'readiness', label: 'Fleet Readiness', icon: '⚡', hint: 'Fuel, ammo, hull status of all ships' },
    { id: 'threats',   label: 'Threat Board',    icon: '🎯', hint: 'Enemy contacts sorted by threat level' },
    { id: 'roles',     label: 'Battle Roles',    icon: '🛡️', hint: 'Assign assault/defense/reserve roles to groups' },
    { id: 'vectors',   label: 'Attack Vectors',  icon: '↗️', hint: 'Plan attack routes — shown on the 3D map' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-krt-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.hint}
            className={`flex items-center gap-1 px-2 py-1.5 text-[11px] transition-colors border-b-2 flex-1 justify-center ${
              tab === t.id
                ? 'border-krt-accent text-krt-accent'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline leading-tight text-center">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden p-2 overflow-y-auto">
        {tab === 'readiness' && <ReadinessTab />}
        {tab === 'threats'   && <ThreatBoardTab />}
        {tab === 'roles'     && <GroupRolesTab missionId={missionId} />}
        {tab === 'vectors'   && <VectorsTab missionId={missionId} />}
      </div>
    </div>
  );
}
