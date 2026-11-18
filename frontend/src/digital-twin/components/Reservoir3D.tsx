import React from 'react';
import { Html } from '@react-three/drei';
import { SPATIAL_LAYOUT } from '../utils/spatialLayout';
import { getTemperatureColor } from '../utils/temperatureColor';

interface Props {
  secondaryTempC: number;
  storedEnergyJ: number;
  minTempC: number;
  isSelected: boolean;
  onSelect: () => void;
  showLabels: boolean;
  showHeatmap: boolean;
}

export const Reservoir3D: React.FC<Props> = ({
  secondaryTempC,
  storedEnergyJ,
  minTempC,
  isSelected,
  onSelect,
  showLabels,
  showHeatmap,
}) => {
  const resPos = SPATIAL_LAYOUT.reservoir.position;
  const waterColor = getTemperatureColor(secondaryTempC);

  return (
    <group position={resPos} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Insulated Outer Tank Base & Top Cap */}
      <mesh position={[0, -1.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.1, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.1, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
      </mesh>
      {[0, 1, 2, 3].map(index => {
        const angle = Math.PI / 4 + index * Math.PI / 2;
        return <mesh key={index} position={[Math.cos(angle)*.9,0,Math.sin(angle)*.9]} castShadow>
          <cylinderGeometry args={[.032,.032,2.04,12]} />
          <meshStandardMaterial color="#91a3ad" metalness={.72} roughness={.39} />
        </mesh>;
      })}

      {/* Transparent Glass Vessel Wall */}
      <mesh>
        <cylinderGeometry args={[0.9, 0.9, 2.0, 32]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transmission={0.88}
          opacity={1}
          transparent
          roughness={0.1}
          ior={1.45}
        />
      </mesh>

      {/* Internal Water Volume (Colored by Bulk Fluid Temperature T_s) */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 1.85, 32]} />
        <meshStandardMaterial
          color={showHeatmap ? waterColor : '#0284c7'}
          transparent
          opacity={0.7}
          roughness={0.1}
          emissive={showHeatmap ? waterColor : '#000000'}
          emissiveIntensity={showHeatmap ? 0.35 : 0.0}
        />
      </mesh>

      {/* Minimum Safety Temperature Ring Indicator */}
      <mesh position={[0, -0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.88, 0.02, 16, 32]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Selection Cylinder */}
      {isSelected && (
        <mesh>
          <cylinderGeometry args={[1.05, 1.05, 2.25, 32]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}

      {/* Floating 3D Label */}
      {showLabels && (
        <Html position={[0, 1.35, 0]} center distanceFactor={13}>
          <div className="bg-slate-950/90 text-amber-200 border border-amber-700/80 px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap shadow-xl backdrop-blur">
            <div>Secondary Storage Reservoir</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Temp: <span className="font-bold text-amber-400">{secondaryTempC.toFixed(1)}°C</span> • {(storedEnergyJ / 1e6).toFixed(2)} MJ
            </div>
            <div className="text-[9px] text-cyan-400 font-mono">
              Min Safety Threshold: {minTempC.toFixed(1)}°C
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
