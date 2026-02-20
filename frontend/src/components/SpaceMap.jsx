import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, Html } from '@react-three/drei';
import { useMissionStore } from '../stores/missionStore';
import UnitMarker from './UnitMarker';
import WaypointLine from './WaypointLine';
import ContactMarker from './ContactMarker';
import TaskMarker from './TaskMarker';
import { CelestialBodyMarker, NavPointMarker } from './NavPointMarker';
import * as THREE from 'three';

/**
 * Camera controller that handles focus-on-unit and focus-on-position animation
 */
function CameraFocus({ controlsRef }) {
  const { camera } = useThree();
  const { focusedUnitId, focusedPosition, units, clearFocus } = useMissionStore();
  const targetPos = useRef(null);
  const animating = useRef(false);

  useEffect(() => {
    // Focus on a unit
    if (focusedUnitId) {
      const unit = units.find((u) => u.id === focusedUnitId);
      if (!unit) return;
      targetPos.current = new THREE.Vector3(unit.pos_x, unit.pos_y + 200, unit.pos_z + 200);
      if (controlsRef.current) {
        controlsRef.current.target.set(unit.pos_x, unit.pos_y, unit.pos_z);
      }
      animating.current = true;
    }
    // Focus on an arbitrary position
    else if (focusedPosition) {
      const { x, y, z } = focusedPosition;
      targetPos.current = new THREE.Vector3(x, y + 200, z + 200);
      if (controlsRef.current) {
        controlsRef.current.target.set(x, y, z);
      }
      animating.current = true;
    }
    else return;

    const timeout = setTimeout(() => {
      clearFocus();
      animating.current = false;
    }, 1500);
    return () => clearTimeout(timeout);
  }, [focusedUnitId, focusedPosition]);

  useFrame(() => {
    if (!animating.current || !targetPos.current) return;
    camera.position.lerp(targetPos.current, 0.05);
    controlsRef.current?.update();
  });

  return null;
}

/**
 * Inner scene component — must be inside <Canvas> to use R3F hooks
 */
function SceneContents() {
  const { units, groups, waypoints, contacts, tasks, navData, selectedUnitIds } = useMissionStore();
  const controlsRef = useRef();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, []);

  return (
    <>
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        );
      })}

      {/* Waypoint lines */}
      {units.map((unit) => {
        const unitWaypoints = waypoints.filter((w) => w.unit_id === unit.id);
        if (unitWaypoints.length === 0) return null;
        return <WaypointLine key={`wp-${unit.id}`} unit={unit} waypoints={unitWaypoints} />;
      })}

      {/* Contact markers (IFF) */}
      {contacts.filter((c) => c.is_active).map((contact) => (
        <ContactMarker key={`contact-${contact.id}`} contact={contact} />
      ))}

      {/* Task target markers */}
      {tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.target_x != null).map((task) => (
        <TaskMarker key={`task-${task.id}`} task={task} />
      ))}

      {/* Celestial bodies (stars, planets, moons) */}
      {navData.bodies?.map((body) => (
        <CelestialBodyMarker key={`body-${body.id}`} body={body} />
      ))}

      {/* Navigation points (stations, OMs, lagrange, etc.) */}
      {navData.points?.map((point) => (
        <NavPointMarker key={`nav-${point.id}`} point={point} />
      ))}

      {/* Origin marker */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[5, 16, 16]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>

      {/* Camera focus animation */}
      <CameraFocus controlsRef={controlsRef} />

      {/* Camera controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        minDistance={10}
        maxDistance={100000}
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
    </>
  );
}

/**
 * Main 3D space map component using React Three Fiber
 */
export default function SpaceMap() {
  return (
    <Canvas
      camera={{ position: [0, 5000, 15000], fov: 60, near: 0.1, far: 500000 }}
      style={{ background: '#0a0e1a' }}
    >
      <SceneContents />
    </Canvas>
  );
}
