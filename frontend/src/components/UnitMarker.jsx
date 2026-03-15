import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMissionStore } from '../stores/missionStore';
import { usePopupStore } from '../stores/popupStore';
import { emitUnitMove } from '../lib/socket';
import { STATUS_COLORS, MISSION_ICONS } from '../lib/constants';
import toast from 'react-hot-toast';
import * as THREE from 'three';

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const verticalDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const intersection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const planeAnchor = new THREE.Vector3();

export default function UnitMarker({ unit, group, isSelected, onDragStart, onDragEnd }) {
  const { camera } = useThree();
  const meshRef = useRef();
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartPos = useRef(null);
  const dragAxis = useRef(null);
  const dragWorldStart = useRef(null);
  const capturedPointerId = useRef(null);
  const AXIS_LOCK_THRESHOLD = 2;
  const { toggleSelectUnit, updateUnit, canEdit } = useMissionStore();
  const { openUnitDetail, openPersonDetail } = usePopupStore();
  const canDrag = canEdit(unit.group_id);

  const statusColor = STATUS_COLORS[unit.status] || '#6b7280';
  const color = group?.color || statusColor;
  const markerSize = isSelected ? 12 : 8;

  useEffect(() => {
    return () => {
      if (capturedPointerId.current != null && meshRef.current) {
        try { meshRef.current.releasePointerCapture(capturedPointerId.current); } catch { /* already released */ }
        capturedPointerId.current = null;
      }
    };
  }, []);

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
    if (!canDrag) return;
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
    capturedPointerId.current = e.pointerId;
    e.target.setPointerCapture(e.pointerId);
    onDragStart?.();
  }, [camera, unit.pos_x, unit.pos_y, unit.pos_z, onDragStart, canDrag]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    e.stopPropagation();
    const shiftMode = !!e.sourceEvent?.shiftKey;
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
      if (!dragWorldStart.current) {
        dragWorldStart.current = { x: intersection.x, z: intersection.z };
      }

      if (!dragAxis.current) {
        const adx = Math.abs(intersection.x - dragWorldStart.current.x);
        const adz = Math.abs(intersection.z - dragWorldStart.current.z);
        if (adx > AXIS_LOCK_THRESHOLD || adz > AXIS_LOCK_THRESHOLD) {
          dragAxis.current = adx >= adz ? 'x' : 'z';
        } else {
          return;
        }
      }

      const startX = dragStartPos.current?.x ?? unit.pos_x;
      const startZ = dragStartPos.current?.z ?? unit.pos_z;
      const newX = dragAxis.current === 'x' ? intersection.x : startX;
      const newZ = dragAxis.current === 'z' ? intersection.z : startZ;

      if (groupRef.current) {
        groupRef.current.position.x = newX;
        groupRef.current.position.z = newZ;
      }
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
    capturedPointerId.current = null;
    onDragEnd?.();

    const finalX = groupRef.current?.position.x ?? unit.pos_x;
    const finalY = groupRef.current?.position.y ?? unit.pos_y;
    const finalZ = groupRef.current?.position.z ?? unit.pos_z;

    const dx = finalX - (dragStartPos.current?.x ?? unit.pos_x);
    const dy = finalY - (dragStartPos.current?.y ?? unit.pos_y);
    const dz = finalZ - (dragStartPos.current?.z ?? unit.pos_z);
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dz) < 0.1) {
      toggleSelectUnit(unit.id);
      return;
    }

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
      } else {
        toast.error('Failed to move unit');
        if (groupRef.current && dragStartPos.current) {
          groupRef.current.position.set(dragStartPos.current.x, dragStartPos.current.y, dragStartPos.current.z);
        }
      }
    } catch {
      toast.error('Failed to move unit');
      if (groupRef.current && dragStartPos.current) {
        groupRef.current.position.set(dragStartPos.current.x, dragStartPos.current.y, dragStartPos.current.z);
      }
    }
    dragStartPos.current = null;
  }, [dragging, unit, toggleSelectUnit, updateUnit, onDragEnd]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (!canDrag) {
      toggleSelectUnit(unit.id);
    }
  }, [canDrag, toggleSelectUnit, unit.id]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    if (unit.unit_type === 'person') {
      openPersonDetail(unit.id);
      return;
    }
    openUnitDetail(unit.id);
  }, [openPersonDetail, openUnitDetail, unit.id, unit.unit_type]);

  const callsignLabel = unit.callsign ? `[${unit.callsign}] ` : '';

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
          opacity={unit.status === 'disabled' ? 0.5 : 0.9}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[markerSize + 4, markerSize + 6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Heading indicator */}
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

      {/* Permanent callsign label (always visible) */}
      <Html
        position={[0, -(markerSize + 8), 0]}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="text-[11px] text-center whitespace-nowrap font-medium" style={{ color, textShadow: '0 0 4px rgba(0,0,0,0.9)' }}>
          {callsignLabel}{unit.name}
        </div>
      </Html>

      {/* Detailed label (on hover/select) */}
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
              {unit.ship_type || 'Unknown'} • {unit.status?.replace(/_/g, ' ')}
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
        <meshBasicMaterial color={statusColor} />
      </mesh>
    </group>
  );
}
