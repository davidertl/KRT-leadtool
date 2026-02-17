/**
 * Zod validation schemas for all API inputs
 */

const { z } = require('zod');

// Reusable pieces
const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().nullable();
const coordinate = z.number().finite();
const optionalCoordinate = z.number().finite().optional();

// ---- Units ----

const UNIT_STATUSES = ['idle', 'en_route', 'on_station', 'engaged', 'rtb', 'disabled'];
const UNIT_TYPES = ['ship', 'ground_vehicle', 'squad', 'person', 'npc_contact', 'marker'];
const ROE_VALUES = ['weapons_free', 'weapons_tight', 'weapons_hold', 'defensive', 'aggressive', 'no_fire'];
const percentage = z.number().int().min(0).max(100);

const createUnit = z.object({
  name: z.string().min(1).max(256),
  callsign: z.string().max(64).optional().nullable(),
  ship_type: z.string().max(128).optional().nullable(),
  unit_type: z.enum(UNIT_TYPES).default('ship'),
  team_id: uuid,
  group_id: optionalUuid,
  role: z.string().max(128).optional().nullable(),
  crew_count: z.number().int().min(0).optional(),
  crew_max: z.number().int().min(0).optional().nullable(),
  pos_x: z.number().finite().default(0),
  pos_y: z.number().finite().default(0),
  pos_z: z.number().finite().default(0),
  heading: z.number().finite().default(0),
  fuel: percentage.default(100),
  ammo: percentage.default(100),
  hull: percentage.default(100),
  status: z.enum(UNIT_STATUSES).default('idle'),
  roe: z.enum(ROE_VALUES).default('weapons_tight'),
  notes: z.string().max(2000).optional().nullable(),
});

const updateUnit = z.object({
  name: z.string().min(1).max(256).optional(),
  callsign: z.string().max(64).optional().nullable(),
  ship_type: z.string().max(128).optional().nullable(),
  unit_type: z.enum(UNIT_TYPES).optional(),
  group_id: optionalUuid,
  role: z.string().max(128).optional().nullable(),
  crew_count: z.number().int().min(0).optional(),
  crew_max: z.number().int().min(0).optional().nullable(),
  pos_x: optionalCoordinate,
  pos_y: optionalCoordinate,
  pos_z: optionalCoordinate,
  heading: optionalCoordinate,
  fuel: percentage.optional(),
  ammo: percentage.optional(),
  hull: percentage.optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  roe: z.enum(ROE_VALUES).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const batchPosition = z.object({
  updates: z.array(z.object({
    id: uuid,
    pos_x: coordinate,
    pos_y: coordinate,
    pos_z: coordinate,
    heading: optionalCoordinate,
  })).min(1).max(100),
});

// ---- Groups ----

const MISSION_TYPES = ['SAR', 'FIGHTER', 'MINER', 'TRANSPORT', 'RECON', 'LOGISTICS', 'CUSTOM'];

const createGroup = z.object({
  name: z.string().min(1).max(256),
  team_id: uuid,
  mission: z.enum(MISSION_TYPES).default('CUSTOM'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3B82F6'),
  icon: z.string().max(64).default('default'),
});

const updateGroup = z.object({
  name: z.string().min(1).max(256).optional(),
  mission: z.enum(MISSION_TYPES).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(64).optional(),
});

// ---- Waypoints ----

const createWaypoint = z.object({
  unit_id: uuid,
  pos_x: coordinate,
  pos_y: coordinate,
  pos_z: coordinate,
  sequence: z.number().int().min(0).optional(),
  label: z.string().max(256).optional().nullable(),
});

// ---- Teams ----

const createTeam = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2000).optional().nullable(),
  settings: z.record(z.unknown()).optional().default({}),
});

const updateTeam = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

const addTeamMember = z.object({
  user_id: uuid,
  role: z.enum(['admin', 'leader', 'member']).default('member'),
});

module.exports = {
  schemas: {
    createUnit,
    updateUnit,
    batchPosition,
    createGroup,
    updateGroup,
    createWaypoint,
    createTeam,
    updateTeam,
    addTeamMember,
  },
};
