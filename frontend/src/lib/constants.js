/**
 * Shared color constants and options used across the application.
 * Single source of truth — import from here instead of duplicating.
 */

/* ─── Unit Status ──────────────────── */

export const STATUS_OPTIONS = [
  'boarding',
  'ready_for_takeoff',
  'on_the_way',
  'arrived',
  'ready_for_orders',
  'in_combat',
  'heading_home',
  'damaged',
  'disabled',
];

export const STATUS_LABELS = {
  boarding: 'Boarding',
  ready_for_takeoff: 'Ready for Takeoff',
  on_the_way: 'On the Way',
  arrived: 'Arrived',
  ready_for_orders: 'Ready for Orders',
  in_combat: 'In Combat',
  heading_home: 'Heading Home',
  damaged: 'Damaged',
  disabled: 'Disabled',
};

export const STATUS_COLORS = {
  boarding: '#a855f7',
  ready_for_takeoff: '#3b82f6',
  on_the_way: '#06b6d4',
  arrived: '#22c55e',
  ready_for_orders: '#eab308',
  in_combat: '#ef4444',
  heading_home: '#f97316',
  damaged: '#dc2626',
  disabled: '#374151',
};

/* ─── Rules of Engagement ──────────── */

export const ROE_LABELS = {
  aggressive: { label: 'AGGRESSIVE', color: '#dc2626' },
  fire_at_will: { label: 'FIRE AT WILL', color: '#ef4444' },
  fire_at_id_target: { label: 'FIRE AT ID TARGET', color: '#f59e0b' },
  self_defence: { label: 'SELF DEFENCE', color: '#22c55e' },
  dnf: { label: 'DO NOT FIRE', color: '#9ca3af' },
};

/* ─── IFF (Identification Friend or Foe) ── */

export const IFF_COLORS = {
  friendly: '#22c55e',
  hostile: '#ef4444',
  neutral: '#eab308',
  unknown: '#a855f7',
};

/* ─── Task Priority ────────────────── */

export const PRIORITY_COLORS = {
  low: '#6b7280',
  normal: '#3b82f6',
  high: '#eab308',
  critical: '#ef4444',
};

export const PRIORITY_BADGE_COLORS = {
  low: '#4b5563',
  normal: '#2563eb',
  high: '#ca8a04',
  critical: '#dc2626',
};

export const TASK_STATUS_OPTIONS = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

/* ─── Group / Class Types ──────────── */

export const CLASS_TYPES = [
  { value: 'SAR', label: '🔍 Search & Rescue', color: '#f59e0b' },
  { value: 'POV', label: '🚗 POV', color: '#64748b' },
  { value: 'FIGHTER', label: '⚔️ Fighter', color: '#ef4444' },
  { value: 'MINER', label: '⛏️ Mining', color: '#a855f7' },
  { value: 'TRANSPORT', label: '📦 Transport', color: '#22c55e' },
  { value: 'RECON', label: '👁️ Recon', color: '#06b6d4' },
  { value: 'LOGISTICS', label: '🔧 Logistics', color: '#f97316' },
  { value: 'CUSTOM', label: '📌 Custom', color: '#6b7280' },
];

export const MISSION_ICONS = {
  SAR: '🔍',
  POV: '🚗',
  FIGHTER: '⚔️',
  MINER: '⛏️',
  TRANSPORT: '📦',
  RECON: '👁️',
  LOGISTICS: '🔧',
  CUSTOM: '📌',
};

/* ─── Connection Status ────────────── */

export const CONNECTION_STATUS = {
  connected: { color: '#22c55e', label: 'Connected', pulse: false },
  disconnected: { color: '#ef4444', label: 'Disconnected', pulse: false },
  reconnecting: { color: '#eab308', label: 'Reconnecting…', pulse: true },
};
