import React, { useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { GPUState } from '../../types';
import { getTemperatureColor } from '../utils/temperatureColor';

interface Props {
  gpu: GPUState;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: (id: string) => void;
  showLabels: boolean;
  showHeatmap: boolean;
}

export const GPUUnit3D: React.FC<Props> = ({
  gpu,
  position,
  isSelected,
  onSelect,
  showLabels,
  showHeatmap,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const tempColor = getTemperatureColor(gpu.current_temp_c);
  const baseColor = showHeatmap ? tempColor : '#334155';

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(gpu.gpu_id); }}>
      {/* GPU Package / Base Heatspreader */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.4, 0.9]} />
        <meshStandardMaterial
          color={baseColor}
          metalness={0.8}
          roughness={0.25}
          emissive={showHeatmap ? tempColor : '#000000'}
          emissiveIntensity={showHeatmap ? 0.35 : 0.0}
        />
      </mesh>

      {/* Die Surface Core */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.9, 0.05, 0.6]} />
        <meshStandardMaterial
          color={showHeatmap ? tempColor : '#0f172a'}
          metalness={0.9}
          roughness={0.1}
          emissive={showHeatmap ? tempColor : '#1e293b'}
          emissiveIntensity={showHeatmap ? 0.6 : 0.1}
        />
      </mesh>

      {/* Cold Plate Microchannel Block */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.2, 0.2, 0.8]} />
        <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.2} transparent opacity={0.85} />
      </mesh>

      {/* Inlet / Outlet Cold Plate Fittings */}
      <mesh position={[-0.45, 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.15, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.45, 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.15, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Selection Halo */}
      {isSelected && (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.75, 0.7, 1.05]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}

      {/* Floating 3D Label */}
      {showLabels && (
        <Html position={[0, 0.75, 0]} center distanceFactor={12}>
          <div className="bg-slate-950/90 text-[10px] text-slate-100 font-mono px-2 py-0.5 rounded border border-slate-700/80 shadow pointer-events-none whitespace-nowrap flex items-center gap-1.5 backdrop-blur">
            <span className="font-bold text-indigo-400">{gpu.gpu_id}</span>
            <span className="font-medium" style={{ color: tempColor }}>
              {gpu.current_temp_c.toFixed(1)}°C
            </span>
          </div>
        </Html>
      )}
    </group>
  );
};
