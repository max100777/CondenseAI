import React from 'react';
import { Html } from '@react-three/drei';
import { SPATIAL_LAYOUT } from '../utils/spatialLayout';
import { getTemperatureColor } from '../utils/temperatureColor';

interface Props {
  hxHeatTransferW: number;
  hxEffectiveness: number;
  primaryInletTempC: number;
  primaryOutletTempC: number;
  secondaryInletTempC: number;
  secondaryOutletTempC: number;
  isSelected: boolean;
  onSelect: () => void;
  plates: boolean;
  exploded: boolean;
  showLabels: boolean;
  showHeatmap: boolean;
}

export const HeatExchanger3D: React.FC<Props> = ({
  hxHeatTransferW,
  hxEffectiveness,
  primaryInletTempC,
  primaryOutletTempC,
  secondaryInletTempC,
  secondaryOutletTempC,
  isSelected,
  onSelect,
  plates, exploded,
  showLabels,
  showHeatmap,
}) => {
  const hxPos = SPATIAL_LAYOUT.heatExchanger.position;
  const primaryInColor = getTemperatureColor(primaryInletTempC);
  const primaryOutColor = getTemperatureColor(primaryOutletTempC);
  const secondaryInColor = getTemperatureColor(secondaryInletTempC);
  const secondaryOutColor = getTemperatureColor(secondaryOutletTempC);

  return (
    <group position={hxPos} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Exchanger Main Stainless Steel Frame */}
      {!plates && !exploded && <group>
        {[-.46, .46].map(z => <mesh key={z} position={[0, 0, z]} castShadow receiveShadow>
          <boxGeometry args={[1.12, 2.2, .10]} />
          <meshStandardMaterial color="#526574" metalness={.76} roughness={.35} />
        </mesh>)}
        {Array.from({length: 11}, (_, index) => <mesh key={index} position={[0, 0, -.39 + index * .078]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 1.92, .044]} />
          <meshStandardMaterial color="#9aa7ae" metalness={.8} roughness={.44} />
        </mesh>)}
        {[-.48, .48].flatMap(x => [-.99, .99].map(y => <mesh key={`${x}:${y}`} position={[x,y,0]} rotation={[Math.PI/2,0,0]}>
          <cylinderGeometry args={[.043,.043,1.12,12]} />
          <meshStandardMaterial color="#a8b4bd" metalness={.8} roughness={.39} />
        </mesh>))}
      </group>}

      {/* Internal Plate Pack (Alternating Flow Channels) */}
      <group visible={plates || exploded}>
        {[-0.3, -0.15, 0.0, 0.15, 0.3].map((z, idx) => (
          <mesh key={z} position={[exploded ? z : 0, 0, z * (exploded ? 4 : 1)]}>
            <boxGeometry args={[0.95, 1.8, 0.04]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? (showHeatmap ? primaryInColor : '#0284c7') : (showHeatmap ? secondaryOutColor : '#059669')}
              metalness={0.95}
              roughness={0.15}
            />
          </mesh>
        ))}
      </group>

      {/* Primary Side Flanges (Hot In / Cooled Out) */}
      {/* Primary In (Upper Left) */}
      <group position={[-0.6, 0.7, 0.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial color={showHeatmap ? primaryInColor : '#38bdf8'} metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
      {/* Primary Out (Lower Left) */}
      <group position={[-0.6, -0.7, 0.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial color={showHeatmap ? primaryOutColor : '#0284c7'} metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* Secondary Side Flanges (Cool In / Heated Out) */}
      {/* Secondary In (Lower Right - Counterflow direction) */}
      <group position={[0.6, -0.7, -0.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial color={showHeatmap ? secondaryInColor : '#10b981'} metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
      {/* Secondary Out (Upper Right - Heated feed to reservoir) */}
      <group position={[0.6, 0.7, -0.2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial color={showHeatmap ? secondaryOutColor : '#f59e0b'} metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* Selection Box */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[1.25, 2.35, 1.05]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}

      {/* Floating 3D Label */}
      {showLabels && (
        <Html position={[0, 1.45, 0]} center distanceFactor={13}>
          <div className="bg-slate-950/90 text-cyan-200 border border-cyan-700/80 px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap shadow-xl backdrop-blur">
            <div>Counterflow Heat Exchanger</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Q: <span className="text-cyan-300 font-bold">{hxHeatTransferW.toFixed(1)} W</span> • ε: {(hxEffectiveness * 100).toFixed(1)}%
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
