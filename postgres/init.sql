-- ============================================================
-- KRT-Leadtool Database Schema
-- PostgreSQL 16 + PostGIS 3.4
-- ============================================================

-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Custom ENUM types
-- ============================================================

CREATE TYPE class_type AS ENUM (
    'SAR',          -- Search and Rescue
    'POV',          -- Ground Combat
    'FIGHTER',      -- Combat / Fighter escort
    'MINER',        -- Mining operations
    'TRANSPORT',    -- Hauling / Transport
    'RECON',        -- Scouting
    'LOGISTICS',    -- Supply / Logistics
    'CUSTOM'        -- User-defined mission
);

CREATE TYPE unit_status AS ENUM (
    'boarding',         -- In the process of boarding
    'ready_for_takeoff',-- Standby / no active task
    'on_the_way',       -- Moving to destination
    'arrived',          -- Arrived at assigned position
    'ready_for_orders', -- Awaiting new orders
    'in_combat',        -- In combat or active operation
    'heading_home',     -- Returning to base
    'disabled'          -- Damaged / out of action
);

CREATE TYPE user_role AS ENUM (
    'admin',        -- Full system access
    'leader',       -- Can manage groups and units
    'member'        -- Can view and update own unit
);

-- IFF (Identification Friend or Foe) classification
CREATE TYPE iff_class AS ENUM (
    'friendly',     -- Allied / friendly
    'hostile',      -- Enemy / hostile
    'neutral',      -- Non-combatant / neutral
    'unknown'       -- Unidentified
);

-- Contact threat level
CREATE TYPE threat_level AS ENUM (
    'none',
    'low',
    'medium',
    'high',
    'critical'
);

-- Task priority
CREATE TYPE task_priority AS ENUM (
    'low',
    'normal',
    'high',
    'critical'
);

-- Task status
CREATE TYPE task_status AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
);

-- Task type (standard military task types)
CREATE TYPE task_type AS ENUM (
    'custom',
    'escort',
    'intercept',
    'recon',
    'pickup',
    'dropoff',
    'hold',
    'patrol',
    'screen',
    'qrf',
    'rescue',
    'repair',
    'refuel',
    'medevac',
    'supply_run',
    'move'
);

-- Unit type
CREATE TYPE unit_type AS ENUM (
    'ship',
    'ground_vehicle',
    'person',
    'npc_contact'
);

-- Mission role (in-mission permission level)
CREATE TYPE mission_role AS ENUM (
    'gesamtlead',   -- Full access to everything
    'gruppenlead',  -- Can edit assigned groups and their teamleads
    'teamlead'      -- Read-only + comms only
);

-- Contact confidence
CREATE TYPE contact_confidence AS ENUM (
    'unconfirmed',
    'hearsay',
    'comms',
    'visual',
    'confirmed'
);

-- ROE (Rules of Engagement) presets
CREATE TYPE roe_preset AS ENUM (
    'aggressive',
    'fire_at_will',
    'fire_at_id_target',
    'self_defence',
    'dnf'
);

-- Operation phase
CREATE TYPE op_phase AS ENUM (
    'planning',
    'briefing',
    'phase_1',
    'phase_2',
    'phase_3',
    'phase_4',
    'extraction',
    'debrief',
    'complete'
);

-- Event log type
CREATE TYPE event_type AS ENUM (
    'contact',
    'kill',
    'loss',
    'rescue',
    'task_update',
    'position_report',
    'intel',
    'check_in',
    'check_out',
    'phase_change',
    'alert',
    'custom'
);

-- ============================================================
-- Users table (Discord OAuth2 linked)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id      VARCHAR(32) UNIQUE NOT NULL,
    username        VARCHAR(128) NOT NULL,
    discriminator   VARCHAR(8),
    avatar_url      TEXT,
    role            user_role NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX idx_users_discord_id ON users(discord_id);

-- ============================================================
-- Missions (mission scenarios, formerly "teams")
-- ============================================================
CREATE TABLE missions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    join_code       VARCHAR(8) UNIQUE,                -- shareable code for join requests
    is_public       BOOLEAN NOT NULL DEFAULT false,   -- public missions visible on dashboard
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_missions_owner ON missions(owner_id);
CREATE INDEX idx_missions_join_code ON missions(join_code);

-- ============================================================
-- Groups / Fleets (within a mission)
-- ============================================================
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    name            VARCHAR(256) NOT NULL,
    class_type      class_type NOT NULL DEFAULT 'CUSTOM',
    color           VARCHAR(7) DEFAULT '#3B82F6',   -- hex color for map display
    icon            VARCHAR(64) DEFAULT 'default',   -- icon identifier
    role            VARCHAR(128),                     -- group role e.g. 'Fighter escort'
    roe             roe_preset DEFAULT 'self_defence',-- group-level ROE
    vhf_channel     VARCHAR(64),                      -- VHF channel for comms
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_mission ON groups(mission_id);
CREATE INDEX idx_groups_class_type ON groups(class_type);

-- ============================================================
-- Units / Ships
-- ============================================================
CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(256) NOT NULL,
    callsign        VARCHAR(64),                      -- short name / tactical callsign e.g. "Alpha-1"
    vhf_frequency   INTEGER CHECK (vhf_frequency >= 1 AND vhf_frequency <= 99999),  -- VHF freq 00001-99999
    ship_type       VARCHAR(128),                     -- e.g. "Carrack", "Gladius" (autofill from known types)
    unit_type       unit_type NOT NULL DEFAULT 'ship',
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,

    -- Role & crew
    role            VARCHAR(128),                     -- e.g. "Fighter escort", "Medical"
    crew_count      INTEGER DEFAULT 1,
    crew_max        INTEGER,

    -- Parent unit (person aboard a ship)
    parent_unit_id  UUID REFERENCES units(id) ON DELETE SET NULL,

    -- Discord link (for persons)
    discord_id      VARCHAR(32),                      -- optional link to Discord user for permissions

    -- Position in 3D game space
    pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z           DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading         DOUBLE PRECISION DEFAULT 0,       -- rotation in degrees

    -- Resources (0-100 percentage)
    fuel            INTEGER DEFAULT 100 CHECK (fuel >= 0 AND fuel <= 100),
    ammo            INTEGER DEFAULT 100 CHECK (ammo >= 0 AND ammo <= 100),
    hull            INTEGER DEFAULT 100 CHECK (hull >= 0 AND hull <= 100),

    status          unit_status NOT NULL DEFAULT 'ready_for_takeoff',
    roe             roe_preset DEFAULT 'self_defence',
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_units_owner ON units(owner_id);
CREATE INDEX idx_units_group ON units(group_id);
CREATE INDEX idx_units_mission ON units(mission_id);
CREATE INDEX idx_units_status ON units(status);

-- ============================================================
-- Waypoints (planned movement orders)
-- ============================================================
CREATE TABLE waypoints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    sequence        INTEGER NOT NULL DEFAULT 0,       -- order in route

    -- Target coordinates
    pos_x           DOUBLE PRECISION NOT NULL,
    pos_y           DOUBLE PRECISION NOT NULL,
    pos_z           DOUBLE PRECISION NOT NULL,

    label           VARCHAR(256),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_waypoints_unit ON waypoints(unit_id);
CREATE INDEX idx_waypoints_sequence ON waypoints(unit_id, sequence);

-- ============================================================
-- Status History (audit log for undo/redo)
-- ============================================================
CREATE TABLE status_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

    -- What changed
    field_changed   VARCHAR(64) NOT NULL,             -- 'status', 'position', 'group_id', etc.
    old_value       JSONB,
    new_value       JSONB,

    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_status_history_unit ON status_history(unit_id);
CREATE INDEX idx_status_history_time ON status_history(changed_at DESC);
CREATE INDEX idx_status_history_user ON status_history(changed_by);

-- ============================================================
-- Mission memberships (many-to-many: users ↔ missions)
-- ============================================================
CREATE TABLE mission_members (
    mission_id          UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                user_role NOT NULL DEFAULT 'member',
    mission_role        mission_role DEFAULT 'teamlead',
    assigned_group_ids  UUID[] DEFAULT '{}',          -- groups this member can manage
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (mission_id, user_id)
);

CREATE INDEX idx_mission_members_user ON mission_members(user_id);

-- ============================================================
-- Join Requests (pending requests to join a team/mission)
-- ============================================================
CREATE TABLE join_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(16) NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'declined'
    message         TEXT,                             -- optional message from requester
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(mission_id, user_id)
);

CREATE INDEX idx_join_requests_mission ON join_requests(mission_id, status);
CREATE INDEX idx_join_requests_user ON join_requests(user_id);

-- ============================================================
-- Contacts / IFF tracking (enemy, neutral, unknown contacts)
-- ============================================================
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    reported_by     UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Classification
    iff             iff_class NOT NULL DEFAULT 'unknown',
    threat          threat_level NOT NULL DEFAULT 'none',
    confidence      contact_confidence NOT NULL DEFAULT 'unconfirmed',

    -- Identification
    name            VARCHAR(256),                     -- callsign or identifier
    ship_type       VARCHAR(128),                     -- e.g. "Hammerhead", "Unknown capital"
    count           INTEGER NOT NULL DEFAULT 1,       -- number of hostiles in group

    -- Position in 3D game space
    pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z           DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading         DOUBLE PRECISION DEFAULT 0,

    -- Movement vector (estimated)
    vel_x           DOUBLE PRECISION DEFAULT 0,
    vel_y           DOUBLE PRECISION DEFAULT 0,
    vel_z           DOUBLE PRECISION DEFAULT 0,

    -- SPOTREP fields
    notes           TEXT,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN NOT NULL DEFAULT true,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_mission ON contacts(mission_id);
CREATE INDEX idx_contacts_iff ON contacts(iff);
CREATE INDEX idx_contacts_active ON contacts(mission_id, is_active);

-- ============================================================
-- Tasks / Orders (mission assignments)
-- ============================================================
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to     UUID REFERENCES units(id) ON DELETE SET NULL,
    assigned_group  UUID REFERENCES groups(id) ON DELETE SET NULL,

    title           VARCHAR(256) NOT NULL,
    description     TEXT,
    task_type       task_type NOT NULL DEFAULT 'custom',
    priority        task_priority NOT NULL DEFAULT 'normal',
    status          task_status NOT NULL DEFAULT 'pending',
    roe             roe_preset DEFAULT 'self_defence',

    -- Optional target location
    target_x        DOUBLE PRECISION,
    target_y        DOUBLE PRECISION,
    target_z        DOUBLE PRECISION,

    -- Optional target contact
    target_contact  UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Source spotrep (when task created from a contact/spotrep)
    source_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Phase linkage (for phase-based scheduling)
    phase_id        UUID,  -- FK added after operation_phases table creation

    -- Scheduling
    start_at        TIMESTAMPTZ,
    due_at          TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Dependencies
    depends_on      UUID REFERENCES tasks(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_mission ON tasks(mission_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_unit ON tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_group ON tasks(assigned_group);

-- ============================================================
-- Ship images cache (for frontend display)
-- ============================================================
CREATE TABLE ship_images (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ship_type       VARCHAR(128) UNIQUE NOT NULL,     -- matches units.ship_type
    display_name    VARCHAR(128),                      -- official name from Wiki API
    image_url       TEXT NOT NULL,                     -- cached/proxied image URL
    thumbnail_url   TEXT,
    vehicle_category VARCHAR(32) DEFAULT 'ship',      -- 'ship', 'ground_vehicle', 'gravlev'
    manufacturer    VARCHAR(128),                      -- e.g. 'Aegis Dynamics'
    crew_max        INTEGER,                           -- maximum crew capacity
    fuel_capacity   NUMERIC,                           -- hydrogen fuel capacity
    cargo_capacity  NUMERIC,                           -- cargo capacity in SCU
    hull_hp         NUMERIC,                           -- total hull hit points
    size_class      NUMERIC,                          -- size class for map scaling (1-10)
    source          VARCHAR(64) DEFAULT 'manual',     -- 'manual', 'sc_wiki', etc.
    source_url      TEXT,                              -- original source URL for attribution
    license         VARCHAR(128) DEFAULT 'CC-BY-NC-SA 4.0',
    license_url     TEXT DEFAULT 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    author          VARCHAR(256),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ship_images_type ON ship_images(ship_type);

-- ============================================================
-- Star Systems (Stanton, Pyro, etc.)
-- ============================================================
CREATE TABLE star_systems (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) UNIQUE NOT NULL,
    -- Galaxy-level offset for multi-system rendering
    galaxy_offset_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    galaxy_offset_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    galaxy_offset_z DOUBLE PRECISION NOT NULL DEFAULT 0,
    patch_version   VARCHAR(32),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Celestial Bodies (stars, planets, moons)
-- ============================================================
CREATE TABLE celestial_bodies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id       UUID NOT NULL REFERENCES star_systems(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES celestial_bodies(id) ON DELETE SET NULL,
    name            VARCHAR(256) NOT NULL,
    body_type       VARCHAR(32) NOT NULL,             -- 'star', 'planet', 'moon', 'asteroid_belt'
    -- System-local coordinates (meters)
    pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z           DOUBLE PRECISION NOT NULL DEFAULT 0,
    radius          DOUBLE PRECISION,                 -- in km
    om_radius       DOUBLE PRECISION,                 -- orbital marker radius (km)
    description     TEXT,
    patch_version   VARCHAR(32),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_celestial_bodies_system ON celestial_bodies(system_id);
CREATE INDEX idx_celestial_bodies_parent ON celestial_bodies(parent_id);

-- ============================================================
-- Navigation Points (stations, OMs, lagrange, outposts, jump gates)
-- ============================================================
CREATE TABLE navigation_points (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id       UUID NOT NULL REFERENCES star_systems(id) ON DELETE CASCADE,
    parent_body_id  UUID REFERENCES celestial_bodies(id) ON DELETE SET NULL,
    name            VARCHAR(256) NOT NULL,
    nav_type        VARCHAR(32) NOT NULL,             -- 'om', 'lagrange', 'station', 'outpost', 'jumppoint', 'comm_array', 'rest_stop'
    -- System-local coordinates (meters)
    pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z           DOUBLE PRECISION NOT NULL DEFAULT 0,
    generated       BOOLEAN NOT NULL DEFAULT false,   -- true for generated OMs
    qt_target       BOOLEAN NOT NULL DEFAULT true,    -- is a valid QT destination
    danger_level    VARCHAR(32) DEFAULT 'safe',       -- 'safe', 'contested', 'dangerous', 'restricted'
    description     TEXT,
    patch_version   VARCHAR(32),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nav_points_system ON navigation_points(system_id);
CREATE INDEX idx_nav_points_parent ON navigation_points(parent_body_id);
CREATE INDEX idx_nav_points_type ON navigation_points(nav_type);

-- ============================================================
-- Jump Edges (quantum travel connections between nav points)
-- ============================================================
CREATE TABLE jump_edges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_nav_id     UUID NOT NULL REFERENCES navigation_points(id) ON DELETE CASCADE,
    to_nav_id       UUID NOT NULL REFERENCES navigation_points(id) ON DELETE CASCADE,
    distance        DOUBLE PRECISION,                 -- in km
    cross_system    BOOLEAN NOT NULL DEFAULT false,
    patch_version   VARCHAR(32),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jump_edges_from ON jump_edges(from_nav_id);
CREATE INDEX idx_jump_edges_to ON jump_edges(to_nav_id);

-- ============================================================
-- Operations / Missions (time-bounded command phases)
-- ============================================================
CREATE TABLE operations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    phase           op_phase NOT NULL DEFAULT 'planning',
    roe             roe_preset NOT NULL DEFAULT 'self_defence',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    -- Timer (seconds remaining for current phase)
    timer_seconds   INTEGER DEFAULT 0,
    timer_running   BOOLEAN DEFAULT false,
    timer_started_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operations_mission ON operations(mission_id);

-- ============================================================
-- Event Log / Mission Timeline
-- ============================================================
CREATE TABLE event_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    operation_id    UUID REFERENCES operations(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    unit_id         UUID REFERENCES units(id) ON DELETE SET NULL,
    event           event_type NOT NULL DEFAULT 'custom',
    title           VARCHAR(256) NOT NULL,
    details         TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_log_mission ON event_log(mission_id);
CREATE INDEX idx_event_log_operation ON event_log(operation_id);
CREATE INDEX idx_event_log_time ON event_log(created_at DESC);

-- ============================================================
-- Quick Messages / Check-in Templates
-- ============================================================
CREATE TABLE quick_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    unit_id         UUID REFERENCES units(id) ON DELETE SET NULL,
    message_type    VARCHAR(32) NOT NULL,             -- 'checkin', 'checkout', 'contact', 'rtb', 'winchester', 'bingo', 'hold', 'status', 'custom', 'under_attack'
    message         TEXT,
    recipient_type  VARCHAR(16),                      -- 'all', 'unit', 'group' (null = all)
    recipient_id    UUID,                             -- target unit/group id (null when type='all')
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quick_messages_mission ON quick_messages(mission_id);
CREATE INDEX idx_quick_messages_time ON quick_messages(created_at DESC);

-- ============================================================
-- Map Bookmarks
-- ============================================================
CREATE TABLE bookmarks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    name            VARCHAR(256) NOT NULL,
    pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z           DOUBLE PRECISION NOT NULL DEFAULT 0,
    zoom            DOUBLE PRECISION DEFAULT 500,
    icon            VARCHAR(64) DEFAULT '📌',
    is_shared       BOOLEAN NOT NULL DEFAULT false,   -- visible to all mission members
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_mission ON bookmarks(mission_id);
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- ============================================================
-- Trigger: auto-update updated_at on row changes
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_missions_updated_at
    BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_units_updated_at
    BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ship_images_updated_at
    BEFORE UPDATE ON ship_images FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_star_systems_updated_at
    BEFORE UPDATE ON star_systems FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_celestial_bodies_updated_at
    BEFORE UPDATE ON celestial_bodies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_navigation_points_updated_at
    BEFORE UPDATE ON navigation_points FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_operations_updated_at
    BEFORE UPDATE ON operations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookmarks_updated_at
    BEFORE UPDATE ON bookmarks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Operation Phases (relational phase rows with timing)
-- ============================================================
CREATE TABLE operation_phases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id    UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    phase_type      op_phase NOT NULL DEFAULT 'phase_1',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    planned_start   TIMESTAMPTZ,
    planned_end     TIMESTAMPTZ,
    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operation_phases_op ON operation_phases(operation_id);

CREATE TRIGGER trg_operation_phases_updated_at
    BEFORE UPDATE ON operation_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add FK from tasks.phase_id to operation_phases
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_phase FOREIGN KEY (phase_id) REFERENCES operation_phases(id) ON DELETE SET NULL;

-- ============================================================
-- Operation ROE (per-group/unit/all rules of engagement)
-- ============================================================
CREATE TABLE operation_roe (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id    UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    target_type     VARCHAR(16) NOT NULL,             -- 'all', 'group', 'unit'
    target_id       UUID,                             -- NULL for 'all', group_id or unit_id
    roe             roe_preset NOT NULL DEFAULT 'self_defence'
);

CREATE UNIQUE INDEX uq_operation_roe_target
    ON operation_roe (operation_id, target_type, COALESCE(target_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX idx_operation_roe_op ON operation_roe(operation_id);

-- ============================================================
-- Operation Notes (debrief / phase / task notes)
-- ============================================================
CREATE TABLE operation_notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id    UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    phase_id        UUID REFERENCES operation_phases(id) ON DELETE SET NULL,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    content         TEXT NOT NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operation_notes_op ON operation_notes(operation_id);
