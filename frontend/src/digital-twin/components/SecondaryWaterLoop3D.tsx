import React from 'react';
import { getTemperatureColor } from '../utils/temperatureColor';

interface Props {
  secondaryOutletTempC: number;
  reservoirTempC: number;
  isSelected: boolean;
  onSelect: () => void;
  transparent: boolean;
  showHeatmap: boolean;
}

export const SecondaryWaterLoop3D: React.FC<Props> = ({
  secondaryOutletTempC,
  reservoirTempC,
  isSelected,
  onSelect,
  transparent,
  showHeatmap,
}) => {
  const heatedColor = getTemperatureColor(secondaryOutletTempC);
  const reservoirColor = getTemperatureColor(reservoirTempC);

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* 1. HX Secondary Heated Outlet -> Reservoir Top Inlet */}
      {/* From X=-0.8 to X=0.9 at Y=0.7, Z=-0.2 */}
      <group position={[0.05, 0.7, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.065, 0.065, 1.7, 16]} />
          <meshStandardMaterial
            color={showHeatmap ? heatedColor : '#f59e0b'}
            transparent={transparent} opacity={transparent ? 0.22 : 1} depthWrite={!transparent}
            metalness={0.8}
            roughness={0.25}
            emissive={showHeatmap ? heatedColor : '#000000'}
            emissiveIntensity={showHeatmap ? 0.3 : 0.0}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <cylinderGeometry args={[0.085, 0.085, 1.72, 16]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        )}
      </group>

      {/* 2. Reservoir Bottom Outlet -> HX Secondary Cool Inlet */}
      {/* From X=0.9 to X=-0.8 at Y=-0.7, Z=-0.2 */}
      <group position={[0.05, -0.7, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.065, 0.065, 1.7, 16]} />
          <meshStandardMaterial
            color={showHeatmap ? reservoirColor : '#10b981'}
            transparent={transparent} opacity={transparent ? 0.22 : 1} depthWrite={!transparent}
            metalness={0.8}
            roughness={0.25}
            emissive={showHeatmap ? reservoirColor : '#000000'}
            emissiveIntensity={showHeatmap ? 0.2 : 0.0}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <cylinderGeometry args={[0.085, 0.085, 1.72, 16]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        )}
      </group>

      {/* 3. Reservoir Hot Feed Outlet -> AGMD Module Inflow Channel */}
      {/* From X=2.7 to X=4.4 at Y=0.4, Z=0.0 */}
      <group position={[3.55, 0.4, 0.0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 1.7, 16]} />
          <meshStandardMaterial
            color={showHeatmap ? reservoirColor : '#0284c7'}
            transparent={transparent} opacity={transparent ? 0.22 : 1} depthWrite={!transparent}
            metalness={0.8}
            roughness={0.25}
            emissive={showHeatmap ? reservoirColor : '#000000'}
            emissiveIntensity={showHeatmap ? 0.3 : 0.0}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 1.72, 16]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        )}
      </group>
    </group>
  );
};
