import React, { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, Html } from '@react-three/drei';
import { useMissionStore } from '../stores/missionStore';
import UnitMarker from './UnitMarker';
import WaypointLine from './WaypointLine';

/**
 * Main 3D space map component using React Three Fiber
 */
export default function SpaceMap() {
  const { units, groups, waypoints, selectedUnitIds } = useMissionStore();
  const controlsRef = useRef();

  return (
    <Canvas
      camera={{ position: [0, 500, 500], fov: 60, near: 0.1, far: 100000 }}
      style={{ background: '#0a0e1a' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} />
      <pointLight position={[0, 100, 0]} intensity={0.5} color="#3b82f6" />

      {/* Stars background */}
      <Stars radius={5000} depth={500} count={5000} factor={4} fade speed={0.5} />

      {/* Reference grid */}
      <Grid
        args={[10000, 10000]}
        cellSize={100}
        cellColor="#1a1a2e"
        sectionSize={500}
        sectionColor="#1f2937"
        fadeDistance={5000}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0, 0]}
      />

      {/* Unit markers */}
      {units.map((unit) => {
        const group = groups.find((g) => g.id === unit.group_id);
        return (
          <UnitMarker
            key={unit.id}
            unit={unit}
            group={group}
            isSelected={selectedUnitIds.includes(unit.id)}
          />
        );
      })}

      {/* Waypoint lines */}
      {units.map((unit) => {
        const unitWaypoints = waypoints.filter((w) => w.unit_id === unit.id);
        if (unitWaypoints.length === 0) return null;
        return <WaypointLine key={`wp-${unit.id}`} unit={unit} waypoints={unitWaypoints} />;
      })}

      {/* Origin marker */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[5, 16, 16]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>

      {/* Camera controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        minDistance={10}
        maxDistance={10000}
        enablePan
        panSpeed={2}
        rotateSpeed={0.5}
        zoomSpeed={1.2}
        // Touch support
        touches={{
          ONE: 0, // ROTATE
          TWO: 2, // DOLLY_PAN
        }}
      />
    </Canvas>
  );
}
