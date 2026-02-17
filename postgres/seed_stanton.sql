-- ============================================================
-- Stanton System Seed Data
-- Star Citizen 3.x Navigation Data (approximate coordinates)
-- All positions in meters (system-local)
-- All radii in kilometers
-- ============================================================
-- Run this AFTER init.sql has created the schema.
-- ============================================================

-- ============================================================
-- 1. Star System
-- ============================================================
INSERT INTO star_systems (id, name, galaxy_offset_x, galaxy_offset_y, galaxy_offset_z, patch_version, active)
VALUES (
    '00000000-0000-4000-a000-000000000001',
    'Stanton',
    0, 0, 0,
    '3.24',
    true
) ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Celestial Bodies
-- ============================================================

-- Stanton (star, center of system)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    NULL,
    'Stanton',
    'star',
    0, 0, 0,
    696000,  -- ~696,000 km radius (stellar)
    NULL,
    'Type-K main sequence star at the center of the Stanton system. Owned by the UEE.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── Hurston ──────────────────────────────────────────────────
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000001',
    'Hurston',
    'planet',
    12850457600, 0, 0,
    1000,    -- ~1,000 km radius
    400000,  -- OM radius ~400,000 km
    'Rocky desert planet. Home of Hurston Dynamics. Landing zone: Lorville.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Aberdeen (moon of Hurston)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000011',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Aberdeen',
    'moon',
    12850457600 + 340071000, 0, 170035000,
    274,     -- ~274 km
    100000,
    'Volcanic moon of Hurston. Toxic atmosphere, extreme heat.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Arial (moon of Hurston)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000012',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Arial',
    'moon',
    12850457600 - 215000000, 15000000, -260000000,
    344,     -- ~344 km
    120000,
    'Moon of Hurston. Tidally locked, extreme temperature variance.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Ita (moon of Hurston)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000013',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Ita',
    'moon',
    12850457600 + 180000000, -12000000, 380000000,
    325,     -- ~325 km
    110000,
    'Moon of Hurston. Cold desert world with thin atmosphere.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Magda (moon of Hurston)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000014',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Magda',
    'moon',
    12850457600 - 430000000, 0, 120000000,
    340,
    115000,
    'Moon of Hurston. Smog-covered surface with mineral deposits.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── Crusader ─────────────────────────────────────────────────
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000020',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000001',
    'Crusader',
    'planet',
    -4387000000, 0, 18440000000,
    11700,   -- ~11,700 km radius (gas giant)
    600000,
    'Gas giant with breathable upper atmosphere. Crusader Industries HQ. Landing zone: Orison.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Cellin (moon of Crusader)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000021',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'Cellin',
    'moon',
    -4387000000 + 100000000, 0, 18440000000 + 60000000,
    260,     -- ~260 km
    95000,
    'Moon of Crusader. Volcanic activity, geysers and lava flows.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Daymar (moon of Crusader)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000022',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'Daymar',
    'moon',
    -4387000000 - 80000000, 0, 18440000000 - 150000000,
    295,     -- ~295 km
    100000,
    'Moon of Crusader. Arid desert world with canyons and outposts.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Yela (moon of Crusader)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000023',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'Yela',
    'moon',
    -4387000000 + 200000000, 15000000, 18440000000 + 30000000,
    313,     -- ~313 km
    105000,
    'Moon of Crusader. Ice world with asteroid ring. Home to smuggler outposts.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── ArcCorp ──────────────────────────────────────────────────
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000030',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000001',
    'ArcCorp',
    'planet',
    -17689000000, 0, -5617000000,
    800,     -- ~800 km radius
    350000,
    'Fully urbanized planet (ecumenopolis). ArcCorp corporate HQ. Landing zone: Area18.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Lyria (moon of ArcCorp)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000031',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000030',
    'Lyria',
    'moon',
    -17689000000 + 120000000, 0, -5617000000 + 80000000,
    257,     -- ~257 km
    90000,
    'Moon of ArcCorp. Frozen world with valuable mineral deposits.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Wala (moon of ArcCorp)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000032',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000030',
    'Wala',
    'moon',
    -17689000000 - 90000000, 0, -5617000000 - 160000000,
    283,     -- ~283 km
    95000,
    'Moon of ArcCorp. Tidally heated world with surface outgassing.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── microTech ────────────────────────────────────────────────
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000040',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000001',
    'microTech',
    'planet',
    9832000000, 0, -20195000000,
    900,     -- ~900 km radius
    380000,
    'Frozen planet with severe weather. microTech corporate HQ. Landing zone: New Babbage.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Calliope (moon of microTech)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000041',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'Calliope',
    'moon',
    9832000000 + 100000000, 10000000, -20195000000 + 70000000,
    270,     -- ~270 km
    92000,
    'Moon of microTech. Frozen tundra with sparse outposts.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Clio (moon of microTech)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000042',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'Clio',
    'moon',
    9832000000 - 150000000, 0, -20195000000 - 100000000,
    290,
    98000,
    'Moon of microTech. Icy world with deep canyons.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- Euterpe (moon of microTech)
INSERT INTO celestial_bodies (id, system_id, parent_id, name, body_type, pos_x, pos_y, pos_z, radius, om_radius, description, patch_version)
VALUES (
    '00000000-0000-4000-b000-000000000043',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'Euterpe',
    'moon',
    9832000000 + 50000000, -20000000, -20195000000 + 200000000,
    275,
    93000,
    'Moon of microTech. Windswept frozen surface.',
    '3.24'
) ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. Navigation Points — Major Stations & Landing Zones
-- ============================================================

-- ── Hurston Stations ─────────────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Everus Harbor',
    'station',
    12850457600, 1200000, 0,
    false, true, 'safe',
    'Hurston orbital station. Major trade hub and refueling point.',
    '3.24'
) ON CONFLICT DO NOTHING;

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000002',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Lorville',
    'station',
    12850457600 + 450000, -500000, 300000,
    false, true, 'safe',
    'Hurston surface landing zone. Major city with spaceport.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── Crusader Stations ────────────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000003',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'Seraphim Station',
    'station',
    -4387000000, 15000000, 18440000000,
    false, true, 'safe',
    'Crusader orbital station. Replaced Port Olisar as primary hub.',
    '3.24'
) ON CONFLICT DO NOTHING;

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000004',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'Orison',
    'station',
    -4387000000 - 8000000, -5000000, 18440000000 + 3000000,
    false, true, 'safe',
    'Crusader floating platform city. Landing zone in upper atmosphere.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── ArcCorp Stations ─────────────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000005',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000030',
    'Baijini Point',
    'station',
    -17689000000, 1100000, -5617000000,
    false, true, 'safe',
    'ArcCorp orbital station. Commercial hub and customs checkpoint.',
    '3.24'
) ON CONFLICT DO NOTHING;

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000006',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000030',
    'Area18',
    'station',
    -17689000000 + 380000, -420000, -5617000000 + 250000,
    false, true, 'safe',
    'ArcCorp surface landing zone. Major commercial district.',
    '3.24'
) ON CONFLICT DO NOTHING;

-- ── microTech Stations ───────────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000007',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'Port Tressler',
    'station',
    9832000000, 1300000, -20195000000,
    false, true, 'safe',
    'microTech orbital station. Tech trade hub.',
    '3.24'
) ON CONFLICT DO NOTHING;

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES (
    '00000000-0000-4000-c000-000000000008',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'New Babbage',
    'station',
    9832000000 + 400000, -550000, -20195000000 + 280000,
    false, true, 'safe',
    'microTech surface landing zone. Modern corporate city under a protective dome.',
    '3.24'
) ON CONFLICT DO NOTHING;


-- ============================================================
-- 4. Navigation Points — Lagrange Points & Rest Stops
-- ============================================================

-- ── Hurston Lagrange Points ──────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
(
    '00000000-0000-4000-c000-000000000101',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'HUR-L1',
    'rest_stop',
    11565000000, 0, 0,
    false, true, 'safe',
    'Hurston L1 rest stop. Between Stanton and Hurston.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000102',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'HUR-L2',
    'rest_stop',
    14135000000, 0, 0,
    false, true, 'safe',
    'Hurston L2 rest stop. Beyond Hurston orbit.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000103',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'HUR-L3',
    'lagrange',
    -12850000000, 0, 0,
    false, true, 'contested',
    'Hurston L3 point. Opposite side of Stanton from Hurston. Contested area.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000104',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'HUR-L4',
    'rest_stop',
    6425000000, 0, 11126000000,
    false, true, 'safe',
    'Hurston L4 rest stop. 60° ahead of Hurston in orbit.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000105',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'HUR-L5',
    'rest_stop',
    6425000000, 0, -11126000000,
    false, true, 'safe',
    'Hurston L5 rest stop. 60° behind Hurston in orbit.',
    '3.24'
);

-- ── Crusader Lagrange Points ─────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
(
    '00000000-0000-4000-c000-000000000201',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'CRU-L1',
    'rest_stop',
    -2193000000, 0, 9220000000,
    false, true, 'safe',
    'Crusader L1 rest stop. Between Stanton and Crusader.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000204',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'CRU-L4',
    'rest_stop',
    -18167000000, 0, 5605000000,
    false, true, 'safe',
    'Crusader L4 rest stop. 60° ahead of Crusader.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000205',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'CRU-L5',
    'rest_stop',
    13780000000, 0, 13562000000,
    false, true, 'safe',
    'Crusader L5 rest stop. 60° behind Crusader.',
    '3.24'
);

-- ── ArcCorp Lagrange Points ──────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
(
    '00000000-0000-4000-c000-000000000301',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000030',
    'ARC-L1',
    'rest_stop',
    -15920000000, 0, -5055000000,
    false, true, 'safe',
    'ArcCorp L1 rest stop. Between Stanton and ArcCorp.',
    '3.24'
);

-- ── microTech Lagrange Points ────────────────────────────────

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
(
    '00000000-0000-4000-c000-000000000401',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'MIC-L1',
    'rest_stop',
    8849000000, 0, -18175000000,
    false, true, 'safe',
    'microTech L1 rest stop. Between Stanton and microTech.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000402',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'MIC-L2',
    'lagrange',
    10815000000, 0, -22215000000,
    false, true, 'contested',
    'microTech L2 point. Beyond microTech orbit. Contested area.',
    '3.24'
);


-- ============================================================
-- 5. Navigation Points — Comm Arrays
-- ============================================================

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
(
    '00000000-0000-4000-c000-000000000501',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000010',
    'Comm Array ST1-26 (Hurston)',
    'comm_array',
    12850457600 + 500000000, 50000000, -200000000,
    false, true, 'contested',
    'Communications relay near Hurston. Can be disabled by criminals.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000502',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000020',
    'Comm Array ST2-61 (Crusader)',
    'comm_array',
    -4387000000 - 400000000, 30000000, 18440000000 + 300000000,
    false, true, 'contested',
    'Communications relay near Crusader. Can be disabled by criminals.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000503',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000030',
    'Comm Array ST3-89 (ArcCorp)',
    'comm_array',
    -17689000000 + 350000000, -40000000, -5617000000 - 450000000,
    false, true, 'contested',
    'Communications relay near ArcCorp. Can be disabled by criminals.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000504',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000040',
    'Comm Array ST4-45 (microTech)',
    'comm_array',
    9832000000 - 300000000, 60000000, -20195000000 + 400000000,
    false, true, 'contested',
    'Communications relay near microTech. Can be disabled by criminals.',
    '3.24'
);


-- ============================================================
-- 6. Navigation Points — Notable Outposts & POIs
-- ============================================================

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
-- Grim HEX (asteroid station near Yela)
(
    '00000000-0000-4000-c000-000000000601',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000023',
    'GrimHEX',
    'station',
    -4387000000 + 200000000 + 50000000, 15000000 + 5000000, 18440000000 + 30000000 + 40000000,
    false, true, 'dangerous',
    'Pirate asteroid station near Yela. Lawless zone, no security.',
    '3.24'
),
-- Klescher Rehabilitation Facility (Aberdeen)
(
    '00000000-0000-4000-c000-000000000602',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000011',
    'Klescher Rehabilitation',
    'outpost',
    12850457600 + 340071000 + 200000, -100000, 170035000 + 150000,
    false, true, 'restricted',
    'Prison facility on Aberdeen. Criminals serve their sentence here.',
    '3.24'
),
-- Security Post Kareah (near Cellin)
(
    '00000000-0000-4000-c000-000000000603',
    '00000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-b000-000000000021',
    'Security Post Kareah',
    'station',
    -4387000000 + 100000000 + 30000000, 8000000, 18440000000 + 60000000 + 20000000,
    false, true, 'dangerous',
    'Abandoned security station near Cellin. Frequent PvP hotspot.',
    '3.24'
),
-- Delamar (hidden asteroid base — legacy, but notable)
(
    '00000000-0000-4000-c000-000000000604',
    '00000000-0000-4000-a000-000000000001',
    NULL,
    'Delamar (Levski)',
    'outpost',
    3500000000, -500000000, 8500000000,
    false, true, 'contested',
    'Hidden base in Stanton asteroid belt. Independent settlement.',
    '3.24'
);


-- ============================================================
-- 7. Navigation Points — Jump Points
-- ============================================================

INSERT INTO navigation_points (id, system_id, parent_body_id, name, nav_type, pos_x, pos_y, pos_z, generated, qt_target, danger_level, description, patch_version)
VALUES
(
    '00000000-0000-4000-c000-000000000701',
    '00000000-0000-4000-a000-000000000001',
    NULL,
    'Stanton–Pyro Jump Point',
    'jumppoint',
    -21500000000, 1200000000, 14800000000,
    false, true, 'dangerous',
    'Jump point connecting Stanton to the Pyro system. Dangerous crossing.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000702',
    '00000000-0000-4000-a000-000000000001',
    NULL,
    'Stanton–Magnus Jump Point',
    'jumppoint',
    17200000000, -800000000, 19300000000,
    false, true, 'contested',
    'Jump point connecting Stanton to the Magnus system.',
    '3.24'
),
(
    '00000000-0000-4000-c000-000000000703',
    '00000000-0000-4000-a000-000000000001',
    NULL,
    'Stanton–Terra Jump Point',
    'jumppoint',
    8900000000, 600000000, -24500000000,
    false, true, 'safe',
    'Jump point connecting Stanton to the Terra system. Well-patrolled.',
    '3.24'
);


-- ============================================================
-- 8. Jump Edges (Quantum Travel Connections)
-- ============================================================
-- Major QT routes between stations, rest stops, and planets.
-- Distances are approximate in km.

INSERT INTO jump_edges (id, from_nav_id, to_nav_id, distance, cross_system, patch_version)
VALUES
-- Hurston orbit connections
('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000002', 1200, false, '3.24'),        -- Everus Harbor ↔ Lorville
('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000101', 1285000, false, '3.24'),      -- Everus Harbor ↔ HUR-L1
('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000102', 1285000, false, '3.24'),      -- Everus Harbor ↔ HUR-L2
('00000000-0000-4000-d000-000000000004', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000104', 12850000, false, '3.24'),     -- Everus Harbor ↔ HUR-L4
('00000000-0000-4000-d000-000000000005', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000105', 12850000, false, '3.24'),     -- Everus Harbor ↔ HUR-L5

-- Crusader orbit connections
('00000000-0000-4000-d000-000000000011', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000004', 9500, false, '3.24'),        -- Seraphim ↔ Orison
('00000000-0000-4000-d000-000000000012', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000201', 9480000, false, '3.24'),      -- Seraphim ↔ CRU-L1
('00000000-0000-4000-d000-000000000013', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000601', 65000, false, '3.24'),        -- Seraphim ↔ GrimHEX

-- ArcCorp orbit connections
('00000000-0000-4000-d000-000000000021', '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000006', 1100, false, '3.24'),        -- Baijini Point ↔ Area18
('00000000-0000-4000-d000-000000000022', '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000301', 1859000, false, '3.24'),      -- Baijini Point ↔ ARC-L1

-- microTech orbit connections
('00000000-0000-4000-d000-000000000031', '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000008', 1300, false, '3.24'),        -- Port Tressler ↔ New Babbage
('00000000-0000-4000-d000-000000000032', '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000401', 2020000, false, '3.24'),      -- Port Tressler ↔ MIC-L1

-- Inter-planetary connections (rest stop to rest stop)
('00000000-0000-4000-d000-000000000041', '00000000-0000-4000-c000-000000000101', '00000000-0000-4000-c000-000000000201', 15800000, false, '3.24'),     -- HUR-L1 ↔ CRU-L1
('00000000-0000-4000-d000-000000000042', '00000000-0000-4000-c000-000000000101', '00000000-0000-4000-c000-000000000301', 14500000, false, '3.24'),     -- HUR-L1 ↔ ARC-L1
('00000000-0000-4000-d000-000000000043', '00000000-0000-4000-c000-000000000101', '00000000-0000-4000-c000-000000000401', 20500000, false, '3.24'),     -- HUR-L1 ↔ MIC-L1
('00000000-0000-4000-d000-000000000044', '00000000-0000-4000-c000-000000000201', '00000000-0000-4000-c000-000000000301', 17200000, false, '3.24'),     -- CRU-L1 ↔ ARC-L1
('00000000-0000-4000-d000-000000000045', '00000000-0000-4000-c000-000000000201', '00000000-0000-4000-c000-000000000401', 13500000, false, '3.24'),     -- CRU-L1 ↔ MIC-L1
('00000000-0000-4000-d000-000000000046', '00000000-0000-4000-c000-000000000301', '00000000-0000-4000-c000-000000000401', 18700000, false, '3.24'),     -- ARC-L1 ↔ MIC-L1

-- Station-to-station direct routes
('00000000-0000-4000-d000-000000000051', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000003', 22500000, false, '3.24'),     -- Everus Harbor ↔ Seraphim
('00000000-0000-4000-d000-000000000052', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000005', 31200000, false, '3.24'),     -- Everus Harbor ↔ Baijini Point
('00000000-0000-4000-d000-000000000053', '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000007', 20500000, false, '3.24'),     -- Everus Harbor ↔ Port Tressler
('00000000-0000-4000-d000-000000000054', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000005', 27800000, false, '3.24'),     -- Seraphim ↔ Baijini Point
('00000000-0000-4000-d000-000000000055', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000007', 40200000, false, '3.24'),     -- Seraphim ↔ Port Tressler
('00000000-0000-4000-d000-000000000056', '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000007', 30400000, false, '3.24'),     -- Baijini Point ↔ Port Tressler

-- Jump point connections
('00000000-0000-4000-d000-000000000061', '00000000-0000-4000-c000-000000000205', '00000000-0000-4000-c000-000000000701', 35000000, false, '3.24'),     -- CRU-L5 ↔ Stanton-Pyro JP
('00000000-0000-4000-d000-000000000062', '00000000-0000-4000-c000-000000000401', '00000000-0000-4000-c000-000000000703', 5200000, false, '3.24');      -- MIC-L1 ↔ Stanton-Terra JP


-- ============================================================
-- Done! Stanton system seeded with:
--   1 star system
--   17 celestial bodies (1 star, 4 planets, 12 moons)
--   31 navigation points (8 stations, 10 rest stops/lagrange, 4 comm arrays, 4 outposts/POI, 3 jump points, 2 landing zones)
--   24 jump edges (QT routes connecting the system)
-- ============================================================
