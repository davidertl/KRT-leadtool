import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

const VECTOR_TYPE_OPACITY = {
  attack:  1.0,
  defense: 0.85,
  fallback: 0.7,
  support: 0.75,
  recon:   0.65,
};

/**
 * Renders a single attack/defense/fallback vector as an arrow line in 3D space.
 * Used in SpaceMap to visualise battle plan vectors.
 */
export default function AttackVectorLine({ vector }) {
  const { start_x, start_y, start_z, end_x, end_y, end_z, color, name, vector_type } = vector;

  const { points, arrowPoints, midpoint } = useMemo(() => {
    const start = new THREE.Vector3(start_x, start_y, start_z);
    const end = new THREE.Vector3(end_x, end_y, end_z);

    // Arrowhead: two lines branching back from end
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const arrowLen = Math.min(start.distanceTo(end) * 0.12, 300);
    const arrowTip1 = end.clone().addScaledVector(dir, -arrowLen).addScaledVector(perp, arrowLen * 0.4);
    const arrowTip2 = end.clone().addScaledVector(dir, -arrowLen).addScaledVector(perp, -arrowLen * 0.4);

    return {
      points: [start, end],
      arrowPoints: [arrowTip1, end, arrowTip2],
      midpoint: new THREE.Vector3().lerpVectors(start, end, 0.45),
    };
  }, [start_x, start_y, start_z, end_x, end_y, end_z]);

  const lineColor = color || '#ef4444';
  const opacity = VECTOR_TYPE_OPACITY[vector_type] ?? 0.85;

  return (
    <group>
      {/* Main line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={Float32Array.from(points.flatMap((p) => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={lineColor} transparent opacity={opacity} linewidth={2} />
      </line>

      {/* Arrowhead */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={arrowPoints.length}
            array={Float32Array.from(arrowPoints.flatMap((p) => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={lineColor} transparent opacity={opacity} linewidth={2} />
      </line>

      {/* Label at midpoint */}
      <Html position={[midpoint.x, midpoint.y + 40, midpoint.z]} center distanceFactor={800}>
        <div
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: `1px solid ${lineColor}`,
            color: lineColor,
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {vector_type !== 'attack' && <span style={{ opacity: 0.7 }}>[{vector_type}] </span>}
          {name}
        </div>
      </Html>
    </group>
  );
}
