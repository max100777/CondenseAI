import React from 'react';
import { Html } from '@react-three/drei';
import { GPUState } from '../../types';
import { GPUUnit3D } from './GPUUnit3D';
import { SPATIAL_LAYOUT } from '../utils/spatialLayout';

interface Props {
  gpuStates: GPUState[];
  selectedId: string | null;
  onSelectGPU: (id: string) => void;
  showLabels: boolean;
  showHeatmap: boolean;
}

export const GPUCluster3D: React.FC<Props> = ({
  gpuStates,
  selectedId,
  onSelectGPU,
  showLabels,
  showHeatmap,
}) => {
  const clusterPos = SPATIAL_LAYOUT.gpuCluster.position;
  const n = Math.max(1, gpuStates.length);

  // Compute vertical spacing based on GPU count
  const spacingY = n <= 2 ? 0.9 : 0.6;
  const startY = ((n - 1) * spacingY) / 2;

  return (
    <group position={clusterPos}>
      {/* Server Rack / Chassis Frame */}
      <mesh position={[0, 0, -0.45]} receiveShadow>
        <boxGeometry args={[2.0, Math.max(2.4, n * spacingY + 0.8), 0.2]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Rack Corner Pillars */}
      {[-0.95, 0.95].map((x) =>
        [-0.45, 0.45].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0, z]}>
            <boxGeometry args={[0.08, Math.max(2.4, n * spacingY + 0.8), 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.95} roughness={0.2} />
          </mesh>
        ))
      )}

      {/* Main Coolant Distribution Manifold Headers */}
      <mesh position={[-0.7, 0, 0.45]}>
        <cylinderGeometry args={[0.06, 0.06, Math.max(2.2, n * spacingY + 0.6), 16]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.7, 0, 0.45]}>
        <cylinderGeometry args={[0.06, 0.06, Math.max(2.2, n * spacingY + 0.6), 16]} />
        <meshStandardMaterial color="#f43f5e" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* GPU Units */}
      {gpuStates.map((gpu, idx) => {
        const posY = startY - idx * spacingY;
        return (
          <GPUUnit3D
            key={gpu.gpu_id}
            gpu={gpu}
            position={[0, posY, 0]}
            isSelected={selectedId === gpu.gpu_id}
            onSelect={onSelectGPU}
            showLabels={showLabels}
            showHeatmap={showHeatmap}
          />
        );
      })}

      {/* Rack Header Label */}
      {showLabels && (
        <Html position={[0, Math.max(1.4, (n * spacingY) / 2 + 0.6), 0]} center distanceFactor={14}>
          <div className="bg-indigo-950/90 text-indigo-200 border border-indigo-700/80 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap shadow-lg">
            AI GPU Cluster ({gpuStates.length} Nodes)
          </div>
        </Html>
      )}
    </group>
  );
};
