import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { IFF_COLORS } from '../lib/constants';
import * as THREE from 'three';

const IFF_SHAPES = {
  friendly: 'circle',   // sphere
  hostile: 'diamond',    // octahedron rotated
  neutral: 'square',     // box
  unknown: 'triangle',   // cone
};

const THREAT_SIZES = {
  none: 6,
  low: 8,
  medium: 10,
  high: 12,
  critical: 14,
};

/**
 * 3D marker for a contact/IFF on the map
 * Shape and color vary by IFF classification
 */
export default function ContactMarker({ contact }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  const color = IFF_COLORS[contact.iff] || IFF_COLORS.unknown;
  const size = THREAT_SIZES[contact.threat] || 8;

  // Pulsing animation for active contacts
  useFrame((state) => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      meshRef.current.scale.setScalar(pulse);
      // Rotate hostiles slowly for distinction
      if (contact.iff === 'hostile') {
        meshRef.current.rotation.y += 0.02;
      }
    }
  });

  const renderGeometry = () => {
    switch (contact.iff) {
      case 'friendly':
        return <sphereGeometry args={[size, 16, 16]} />;
      case 'hostile':
        return <octahedronGeometry args={[size, 0]} />;
      case 'neutral':
        return <boxGeometry args={[size * 1.2, size * 1.2, size * 1.2]} />;
      default: // unknown
        return <coneGeometry args={[size, size * 1.5, 4]} />;
    }
  };

  return (
    <group position={[contact.pos_x, contact.pos_y, contact.pos_z]}>
      {/* Contact mesh */}
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {renderGeometry()}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          transparent
          opacity={0.75}
          wireframe={contact.iff === 'unknown'}
        />
      </mesh>

      {/* Threat ring for high/critical */}
      {(contact.threat === 'high' || contact.threat === 'critical') && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size + 4, size + 6, 32]} />
          <meshBasicMaterial
            color={contact.threat === 'critical' ? '#ef4444' : '#f59e0b'}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Count badge (if > 1) */}
      {contact.count > 1 && (
        <Html position={[size + 5, size + 5, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {contact.count}
          </div>
        </Html>
      )}

      {/* Label (on hover) */}
      {hovered && (
        <Html
          position={[0, size + 10, 0]}
          center
          distanceFactor={300}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-krt-panel/90 border border-krt-border rounded-lg px-3 py-2 text-center whitespace-nowrap backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-bold text-white uppercase">{contact.iff}</span>
              {contact.threat !== 'none' && (
                <span className="text-xs text-red-400">⚠ {contact.threat}</span>
              )}
            </div>
            <div className="text-xs text-gray-300 mt-0.5">
              {contact.name || 'Unknown'} {contact.ship_type && `(${contact.ship_type})`}
            </div>
            {contact.count > 1 && (
              <div className="text-xs text-gray-500">×{contact.count}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
