import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Renders waypoint path lines for a unit
 */
export default function WaypointLine({ unit, waypoints }) {
  const points = useMemo(() => {
    const allPoints = [
      new THREE.Vector3(unit.pos_x, unit.pos_y, unit.pos_z),
      ...waypoints
        .sort((a, b) => a.sequence - b.sequence)
        .map((wp) => new THREE.Vector3(wp.pos_x, wp.pos_y, wp.pos_z)),
    ];
    return allPoints;
  }, [unit.pos_x, unit.pos_y, unit.pos_z, waypoints]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  return (
    <group>
      {/* Path line */}
      <line geometry={lineGeometry}>
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.5} linewidth={1} />
      </line>

      {/* Waypoint markers */}
      {waypoints.map((wp, i) => (
        <mesh key={wp.id} position={[wp.pos_x, wp.pos_y, wp.pos_z]}>
          <sphereGeometry args={[4, 8, 8]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}
