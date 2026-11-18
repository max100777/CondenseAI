import React from 'react';
import { getTemperatureColor } from '../utils/temperatureColor';

interface Props {
  primaryTempC: number;
  primaryOutletTempC: number;
  isSelected: boolean;
  onSelect: () => void;
  transparent: boolean;
  showHeatmap: boolean;
}

export const PrimaryCoolantLoop3D: React.FC<Props> = ({
  primaryTempC,
  primaryOutletTempC,
  isSelected,
  onSelect,
  transparent,
  showHeatmap,
}) => {
  const hotColor = getTemperatureColor(primaryTempC);
  const cooledColor = getTemperatureColor(primaryOutletTempC);

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Upper Pipe: Hot Coolant from GPU Cluster to Heat Exchanger Inlet */}
      {/* From X=-4.2 to X=-2.0 at Y=0.7, Z=0.2 */}
      <group position={[-3.1, 0.7, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, 2.2, 16]} />
          <meshStandardMaterial
            color={showHeatmap ? hotColor : '#f43f5e'}
            transparent={transparent} opacity={transparent ? 0.22 : 1} depthWrite={!transparent}
            metalness={0.8}
            roughness={0.2}
            emissive={showHeatmap ? hotColor : '#000000'}
            emissiveIntensity={showHeatmap ? 0.3 : 0.0}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <cylinderGeometry args={[0.09, 0.09, 2.22, 16]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        )}
      </group>

      {/* Lower Pipe: Cooled Return from Heat Exchanger to GPU Cluster */}
      {/* From X=-2.0 to X=-4.2 at Y=-0.7, Z=0.2 */}
      <group position={[-3.1, -0.7, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, 2.2, 16]} />
          <meshStandardMaterial
            color={showHeatmap ? cooledColor : '#38bdf8'}
            transparent={transparent} opacity={transparent ? 0.22 : 1} depthWrite={!transparent}
            metalness={0.8}
            roughness={0.2}
            emissive={showHeatmap ? cooledColor : '#000000'}
            emissiveIntensity={showHeatmap ? 0.2 : 0.0}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <cylinderGeometry args={[0.09, 0.09, 2.22, 16]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
        )}
      </group>

      {/* Pipe Elbows & Connection Rings */}
      <mesh position={[-2.0, 0.7, 0.2]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-2.0, -0.7, 0.2]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};
