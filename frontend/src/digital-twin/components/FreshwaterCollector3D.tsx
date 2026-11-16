import React from 'react';
import { Html } from '@react-three/drei';

interface Props {
  position?: [number, number, number];
  cumulativeVolumeL: number;
  productionRateLh: number;
  maxDisplayVolumeL?: number;
  isSelected: boolean;
  onSelect: () => void;
  showLabels: boolean;
}

export const FreshwaterCollector3D: React.FC<Props> = ({
  position = [5.2, -1.6, 0.0],
  cumulativeVolumeL,
  productionRateLh,
  maxDisplayVolumeL = 0.05, // Scaled for lab-scale membrane area
  isSelected,
  onSelect,
  showLabels,
}) => {
  const cylinderRadius = 0.28;
  const cylinderHeight = 0.9;

  // Fill fraction between 0.05 (empty base) and 0.95
  const fillFraction = Math.min(
    0.95,
    Math.max(0.04, maxDisplayVolumeL > 0 ? (cumulativeVolumeL / maxDisplayVolumeL) * 0.9 : 0.04)
  );
  const waterHeight = cylinderHeight * fillFraction;
  const waterCenterY = -cylinderHeight / 2 + waterHeight / 2;

  // Convert volume to human readable units (mL or L)
  const volumeDisplay =
    cumulativeVolumeL < 0.1
      ? `${(cumulativeVolumeL * 1000).toFixed(1)} mL`
      : `${cumulativeVolumeL.toFixed(3)} L`;

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Heavy Laboratory Stand / Base */}
      <mesh position={[0, -cylinderHeight / 2 - 0.04, 0]}>
        <cylinderGeometry args={[cylinderRadius + 0.08, cylinderRadius + 0.1, 0.08, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Glass Cylinder Outer Shell */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[cylinderRadius, cylinderRadius, cylinderHeight, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#e0f2fe"
          transparent
          opacity={0.3}
          roughness={0.05}
          metalness={0.1}
          transmission={0.85}
          ior={1.5}
          depthWrite={false}
        />
      </mesh>

      {/* Glass Base Floor */}
      <mesh position={[0, -cylinderHeight / 2 + 0.01, 0]}>
        <cylinderGeometry args={[cylinderRadius - 0.01, cylinderRadius - 0.01, 0.02, 32]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.2} transparent opacity={0.6} />
      </mesh>

      {/* Graduated Measurement Rings */}
      {[-0.3, -0.15, 0.0, 0.15, 0.3].map((yOffset, idx) => (
        <mesh key={idx} position={[0, yOffset, 0]}>
          <ringGeometry args={[cylinderRadius - 0.005, cylinderRadius + 0.005, 32]} />
          <meshBasicMaterial color="#94a3b8" side={2} transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Internal Water Volume (Pure Freshwater) */}
      <group position={[0, waterCenterY, 0]}>
        <mesh>
          <cylinderGeometry
            args={[cylinderRadius - 0.015, cylinderRadius - 0.015, waterHeight, 32]}
          />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.7}
            roughness={0.08}
            metalness={0.1}
            emissive="#0284c7"
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Top water meniscus / surface */}
        <mesh position={[0, waterHeight / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[cylinderRadius - 0.015, 32]} />
          <meshStandardMaterial
            color="#7dd3fc"
            transparent
            opacity={0.85}
            roughness={0.05}
          />
        </mesh>
      </group>

      {/* Inflow Stream Droplets from AGMD trough down to collector */}
      {productionRateLh > 0.0001 && (
        <mesh position={[0, cylinderHeight / 2 + 0.18, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.36, 12]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.75}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      )}

      {/* Selection Halo */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[cylinderRadius + 0.04, cylinderRadius + 0.04, cylinderHeight + 0.1, 24]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}

      {/* Live Label */}
      {showLabels && (
        <Html position={[0, cylinderHeight / 2 + 0.45, 0]} center distanceFactor={8} pointerEvents="none">
          <div className="bg-slate-900/90 text-white text-[11px] px-2 py-1 rounded shadow-lg border border-slate-700 whitespace-nowrap backdrop-blur-sm pointer-events-none">
            <div className="font-semibold text-emerald-400">Freshwater Collection</div>
            <div className="text-[10px] text-slate-300">
              Total: <b className="text-white">{volumeDisplay}</b>
            </div>
            <div className="text-[10px] text-slate-300">
              Rate: <b className="text-emerald-300">{(productionRateLh * 1000).toFixed(2)} mL/h</b> ({productionRateLh.toFixed(4)} L/h)
            </div>
            <div className="text-[9px] text-emerald-400/80 font-mono">Purity: &gt;99.9% TDS &lt;5 ppm</div>
          </div>
        </Html>
      )}
    </group>
  );
};
