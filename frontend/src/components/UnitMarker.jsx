import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMissionStore } from '../stores/missionStore';
import { emitUnitMove } from '../lib/socket';
import * as THREE from 'three';

const STATUS_COLORS = {
  idle: '#6b7280',
  en_route: '#3b82f6',
  on_station: '#22c55e',
  engaged: '#ef4444',
  rtb: '#f59e0b',
  disabled: '#4b5563',
};

const MISSION_ICONS = {
  SAR: '🔍',
  FIGHTER: '⚔️',
  MINER: '⛏️',
  TRANSPORT: '📦',
  RECON: '👁️',
  LOGISTICS: '🔧',
  CUSTOM: '📌',
};

/**
 * 3D marker for a single unit/ship on the map
 */
export default function UnitMarker({ unit, group, isSelected }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { toggleSelectUnit } = useMissionStore();

  const color = group?.color || STATUS_COLORS[unit.status] || '#6b7280';
  const markerSize = isSelected ? 12 : 8;

  // Pulse animation for selected units
  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      meshRef.current.scale.setScalar(scale);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    toggleSelectUnit(unit.id);
  };

  return (
    <group position={[unit.pos_x, unit.pos_y, unit.pos_z]}>
      {/* Unit marker (diamond shape) */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <octahedronGeometry args={[markerSize, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : hovered ? 0.5 : 0.2}
          transparent
          opacity={unit.status === 'disabled' ? 0.4 : 0.9}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[markerSize + 4, markerSize + 6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Heading indicator (direction line) */}
      <mesh
        position={[
          Math.sin((unit.heading * Math.PI) / 180) * (markerSize + 10),
          0,
          Math.cos((unit.heading * Math.PI) / 180) * (markerSize + 10),
        ]}
      >
        <sphereGeometry args={[2, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Label (HTML overlay) */}
      {(hovered || isSelected) && (
        <Html
          position={[0, markerSize + 10, 0]}
          center
          distanceFactor={300}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-krt-panel/90 border border-krt-border rounded-lg px-3 py-2 text-center whitespace-nowrap backdrop-blur-sm">
            <div className="text-xs font-bold text-white">
              {MISSION_ICONS[group?.mission] || ''} {unit.name}
            </div>
            <div className="text-xs text-gray-400">
              {unit.ship_type || 'Unknown'} • {unit.status}
            </div>
            {group && (
              <div className="text-xs mt-1" style={{ color: group.color }}>
                {group.name}
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Status indicator dot */}
      <mesh position={[markerSize + 4, markerSize + 4, 0]}>
        <sphereGeometry args={[3, 8, 8]} />
        <meshBasicMaterial color={STATUS_COLORS[unit.status]} />
      </mesh>
    </group>
  );
}
