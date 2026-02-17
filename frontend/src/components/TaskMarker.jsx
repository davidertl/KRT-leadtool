import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const PRIORITY_COLORS = {
  low: '#6b7280',
  normal: '#3b82f6',
  high: '#f59e0b',
  critical: '#ef4444',
};

/**
 * 3D marker for task target locations on the map
 * Only rendered when a task has target coordinates
 */
export default function TaskMarker({ task }) {
  const ringRef = useRef();

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });

  if (task.target_x == null || task.target_y == null || task.target_z == null) return null;

  const color = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal;
  const isCompleted = task.status === 'completed' || task.status === 'cancelled';

  return (
    <group position={[task.target_x, task.target_y, task.target_z]}>
      {/* Target diamond */}
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[6, 6, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={isCompleted ? 0.3 : 0.6}
          wireframe
        />
      </mesh>

      {/* Rotating ring */}
      {!isCompleted && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[12, 14, 4]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label */}
      <Html
        position={[0, 18, 0]}
        center
        distanceFactor={300}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
            isCompleted
              ? 'bg-gray-800/80 border-gray-600 text-gray-500 line-through'
              : 'bg-krt-panel/80 border-krt-border text-white'
          }`}
        >
          📋 {task.title}
        </div>
      </Html>
    </group>
  );
}
