import React, { useRef } from 'react';
import { Html } from '@react-three/drei';

const BODY_COLORS = {
  star: '#ffcc00',
  planet: '#4488ff',
  moon: '#aabbcc',
  asteroid_belt: '#886644',
};

const NAV_COLORS = {
  om: '#666688',
  lagrange: '#88ccff',
  station: '#22cc66',
  outpost: '#aaaa44',
  jumppoint: '#ff66aa',
  comm_array: '#66bbcc',
  rest_stop: '#aa88cc',
};

const DANGER_COLORS = {
  safe: '#22c55e',
  contested: '#f59e0b',
  dangerous: '#ef4444',
  restricted: '#dc2626',
};

/**
 * Renders a celestial body (star, planet, moon) on the 3D map
 */
export function CelestialBodyMarker({ body, scale = 1 }) {
  const color = BODY_COLORS[body.body_type] || '#6688aa';
  // Scale radius for map display (real radii are huge, so we use a log scale)
  const displayRadius = body.radius
    ? Math.max(8, Math.log10(body.radius) * 15)
    : (body.body_type === 'star' ? 40 : body.body_type === 'planet' ? 20 : 10);

  // Scale positions from meters to map units (divide by a large factor)
  const MAP_SCALE = 1e6; // 1 map unit = 1M meters
  const x = (body.pos_x || 0) / MAP_SCALE;
  const y = (body.pos_y || 0) / MAP_SCALE;
  const z = (body.pos_z || 0) / MAP_SCALE;

  return (
    <group position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[displayRadius * scale, body.body_type === 'star' ? 32 : 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={body.body_type === 'star' ? color : '#000000'}
          emissiveIntensity={body.body_type === 'star' ? 2 : 0}
          transparent
          opacity={body.body_type === 'star' ? 1 : 0.8}
          roughness={0.8}
        />
      </mesh>

      {/* Label */}
      <Html
        position={[0, displayRadius * scale + 8, 0]}
        center
        style={{ pointerEvents: 'none', zIndex: 0 }}
        zIndexRange={[0, 0]}
      >
        <div className="text-center whitespace-nowrap">
          <div className="text-[10px] font-bold text-white/80 drop-shadow-lg">
            {body.name}
          </div>
          <div className="text-[8px] text-gray-400">
            {body.body_type}
          </div>
        </div>
      </Html>

      {/* Orbital marker ring (if OM radius is set) */}
      {body.om_radius && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            (body.om_radius / MAP_SCALE) * 0.98,
            (body.om_radius / MAP_SCALE) * 1.02,
            64
          ]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} side={2} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Renders a navigation point (station, OM, lagrange, etc.) on the 3D map
 */
export function NavPointMarker({ point, scale = 1 }) {
  const color = NAV_COLORS[point.nav_type] || '#aaaaaa';
  const dangerColor = DANGER_COLORS[point.danger_level] || DANGER_COLORS.safe;
  const size = point.nav_type === 'station' ? 6 : point.nav_type === 'om' ? 3 : 4;

  const MAP_SCALE = 1e6;
  const x = (point.pos_x || 0) / MAP_SCALE;
  const y = (point.pos_y || 0) / MAP_SCALE;
  const z = (point.pos_z || 0) / MAP_SCALE;

  // Don't render generated OMs to avoid clutter
  if (point.generated) return null;

  return (
    <group position={[x, y, z]}>
      {/* Marker shape varies by type */}
      {point.nav_type === 'station' || point.nav_type === 'rest_stop' ? (
        <mesh>
          <octahedronGeometry args={[size * scale, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.9}
          />
        </mesh>
      ) : point.nav_type === 'jumppoint' ? (
        <mesh>
          <torusGeometry args={[size * scale * 1.5, size * scale * 0.3, 8, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[size * scale, size * scale, size * scale]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Danger indicator ring */}
      {point.danger_level && point.danger_level !== 'safe' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * scale * 2, size * scale * 2.5, 16]} />
          <meshBasicMaterial color={dangerColor} transparent opacity={0.4} side={2} />
        </mesh>
      )}

      {/* Label */}
      <Html
        position={[0, size * scale + 5, 0]}
        center
        style={{ pointerEvents: 'none', zIndex: 0 }}
        zIndexRange={[0, 0]}
      >
        <div className="text-center whitespace-nowrap">
          <div className="text-[9px] text-white/70 drop-shadow-lg">
            {point.name}
          </div>
        </div>
      </Html>
    </group>
  );
}
