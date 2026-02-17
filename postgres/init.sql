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

CREATE TYPE mission_type AS ENUM (
    'SAR',          -- Search and Rescue
    'FIGHTER',      -- Combat / Fighter escort
    'MINER',        -- Mining operations
    'TRANSPORT',    -- Cargo / Transport
    'RECON',        -- Reconnaissance / Scouting
    'LOGISTICS',    -- Supply / Logistics
    'CUSTOM'        -- User-defined mission
);

CREATE TYPE unit_status AS ENUM (
    'idle',         -- Standby / no active task
    'en_route',     -- Moving to destination
    'on_station',   -- Arrived at assigned position
    'engaged',      -- In combat or active operation
    'rtb',          -- Returning to base
    'disabled'      -- Damaged / out of action
);

CREATE TYPE user_role AS ENUM (
    'admin',        -- Full system access
    'leader',       -- Can manage groups and units
    'member'        -- Can view and update own unit
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
-- Teams / Projects (mission scenarios)
-- ============================================================
CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_owner ON teams(owner_id);

-- ============================================================
-- Groups / Fleets (within a team/mission)
-- ============================================================
CREATE TABLE groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name            VARCHAR(256) NOT NULL,
    mission         mission_type NOT NULL DEFAULT 'CUSTOM',
    color           VARCHAR(7) DEFAULT '#3B82F6',   -- hex color for map display
    icon            VARCHAR(64) DEFAULT 'default',   -- icon identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_team ON groups(team_id);
CREATE INDEX idx_groups_mission ON groups(mission);

-- ============================================================
-- Units / Ships
-- ============================================================
CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(256) NOT NULL,
    ship_type       VARCHAR(128),                    -- e.g. "Carrack", "Gladius"
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Position in 3D game space
    pos_x           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_y           DOUBLE PRECISION NOT NULL DEFAULT 0,
    pos_z           DOUBLE PRECISION NOT NULL DEFAULT 0,
    heading         DOUBLE PRECISION DEFAULT 0,      -- rotation in degrees

    status          unit_status NOT NULL DEFAULT 'idle',
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_units_owner ON units(owner_id);
CREATE INDEX idx_units_group ON units(group_id);
CREATE INDEX idx_units_team ON units(team_id);
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
-- Team memberships (many-to-many: users ↔ teams)
-- ============================================================
CREATE TABLE team_members (
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            user_role NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);

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

CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_units_updated_at
    BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
