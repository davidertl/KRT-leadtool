import React, { useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMissionStore } from '../stores/missionStore';
import { usePopupStore } from '../stores/popupStore';
import { emitUnitMove } from '../lib/socket';
import { STATUS_COLORS, MISSION_ICONS } from '../lib/constants';
import * as THREE from 'three';

// Shared plane for raycasting during drag
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const verticalDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const intersection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const planeAnchor = new THREE.Vector3();

/**
 * 3D marker for a single unit/ship on the map
 */
export default function UnitMarker({ unit, group, isSelected, onDragStart, onDragEnd }) {
  const { camera } = useThree();
  const meshRef = useRef();
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartPos = useRef(null);
  const dragAxis = useRef(null);          // 'x' | 'z' | null — locked after first significant move
  const dragWorldStart = useRef(null);    // world-space pointer position at drag start
  const AXIS_LOCK_THRESHOLD = 2;          // world units before axis is locked
  const { toggleSelectUnit, updateUnit, canEdit } = useMissionStore();
  const { openUnitDetail, openPersonDetail } = usePopupStore();
  const canDrag = canEdit(unit.group_id);

  const color = group?.color || STATUS_COLORS[unit.status] || '#6b7280';
  const markerSize = isSelected ? 12 : 8;

  // Pulse animation for selected units
  useFrame((state) => {
    if (meshRef.current && isSelected && !dragging) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      meshRef.current.scale.setScalar(scale);
    } else if (meshRef.current && !dragging) {
      meshRef.current.scale.setScalar(1);
    }
  });

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    if (!canDrag) return; // Teamlead cannot drag
    // Set the drag plane at the unit's Y level
    dragPlane.set(new THREE.Vector3(0, 1, 0), -unit.pos_y);
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    if (cameraDirection.lengthSq() === 0) {
      cameraDirection.set(0, 0, 1);
    } else {
      cameraDirection.normalize();
    }
    planeAnchor.set(unit.pos_x, unit.pos_y, unit.pos_z);
    verticalDragPlane.setFromNormalAndCoplanarPoint(cameraDirection, planeAnchor);

    dragStartPos.current = {
      x: unit.pos_x,
      y: unit.pos_y,
      z: unit.pos_z,
      pointerId: e.pointerId,
    };
    dragAxis.current = null;
    dragWorldStart.current = null;
    setDragging(true);
    e.target.setPointerCapture(e.pointerId);
    onDragStart?.();
  }, [camera, unit.pos_x, unit.pos_y, unit.pos_z, onDragStart, canDrag]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    e.stopPropagation();
    const shiftMode = !!e.sourceEvent?.shiftKey;
    // Raycast against the drag plane
    const ray = e.ray;
    if (ray && shiftMode && ray.intersectPlane(verticalDragPlane, intersection)) {
      const currentX = groupRef.current?.position.x ?? unit.pos_x;
      const newY = intersection.y;
      const currentZ = groupRef.current?.position.z ?? unit.pos_z;
      if (groupRef.current) {
        groupRef.current.position.y = newY;
      }
      emitUnitMove({
        id: unit.id,
        mission_id: unit.mission_id,
        pos_x: currentX,
        pos_y: newY,
        pos_z: currentZ,
      });
      return;
    }

    if (ray && ray.intersectPlane(dragPlane, intersection)) {
      // Record the first world-space intersection to determine axis
      if (!dragWorldStart.current) {
        dragWorldStart.current = { x: intersection.x, z: intersection.z };
      }

      // Determine locked axis once movement exceeds threshold
      if (!dragAxis.current) {
        const adx = Math.abs(intersection.x - dragWorldStart.current.x);
        const adz = Math.abs(intersection.z - dragWorldStart.current.z);
        if (adx > AXIS_LOCK_THRESHOLD || adz > AXIS_LOCK_THRESHOLD) {
          dragAxis.current = adx >= adz ? 'x' : 'z';
        } else {
          return; // not enough movement yet — don't move the unit
        }
      }

      // Apply movement only on the locked axis
      const startX = dragStartPos.current?.x ?? unit.pos_x;
      const startZ = dragStartPos.current?.z ?? unit.pos_z;
      const newX = dragAxis.current === 'x' ? intersection.x : startX;
      const newZ = dragAxis.current === 'z' ? intersection.z : startZ;

      // Update local position immediately for smooth dragging
      if (groupRef.current) {
        groupRef.current.position.x = newX;
        groupRef.current.position.z = newZ;
      }
      // Emit real-time move to other clients (throttled by socket)
      emitUnitMove({
        id: unit.id,
        mission_id: unit.mission_id,
        pos_x: newX,
        pos_y: groupRef.current?.position.y ?? unit.pos_y,
        pos_z: newZ,
      });
    }
  }, [dragging, unit.id, unit.mission_id, unit.pos_x, unit.pos_z, unit.pos_y]);

  const handlePointerUp = useCallback(async (e) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    onDragEnd?.();

    // Get final position from the group ref
    const finalX = groupRef.current?.position.x ?? unit.pos_x;
    const finalY = groupRef.current?.position.y ?? unit.pos_y;
    const finalZ = groupRef.current?.position.z ?? unit.pos_z;

    // Only persist if position actually moved
    const dx = finalX - (dragStartPos.current?.x ?? unit.pos_x);
    const dy = finalY - (dragStartPos.current?.y ?? unit.pos_y);
    const dz = finalZ - (dragStartPos.current?.z ?? unit.pos_z);
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dz) < 0.1) {
      // Didn't move enough — treat as click
      toggleSelectUnit(unit.id);
      return;
    }

    // Persist the new position via REST
    try {
      const res = await fetch(`/api/units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pos_x: finalX, pos_y: finalY, pos_z: finalZ }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateUnit(updated);
      }
    } catch {
      // Revert on failure
      if (groupRef.current) {
        groupRef.current.position.set(unit.pos_x, unit.pos_y, unit.pos_z);
      }
    }
    dragStartPos.current = null;
  }, [dragging, unit, toggleSelectUnit, updateUnit, onDragEnd]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    // Click is handled by pointerUp when drag distance is small
  }, []);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    if (unit.unit_type === 'person') {
      openPersonDetail(unit.id);
      return;
    }
    openUnitDetail(unit.id);
  }, [openPersonDetail, openUnitDetail, unit.id, unit.unit_type]);

  return (
    <group
      ref={groupRef}
      position={[unit.pos_x, unit.pos_y, unit.pos_z]}
    >
      {/* Unit marker (diamond shape) */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => { if (!dragging) setHovered(false); }}
      >
        <octahedronGeometry args={[markerSize, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={dragging ? 1.0 : isSelected ? 0.8 : hovered ? 0.5 : 0.2}
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
          Math.sin(((unit.heading || 0) * Math.PI) / 180) * (markerSize + 10),
          0,
          Math.cos(((unit.heading || 0) * Math.PI) / 180) * (markerSize + 10),
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
              {MISSION_ICONS[group?.class_type] || ''} {unit.name}
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
