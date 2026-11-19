import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  HallConfig,
  FacilityInfrastructureZone,
  SelectionState,
  LayerVisibilityState,
  InfrastructureComponentRef,
} from './facilityData.ts';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';
import FacilityInfrastructure3D from './FacilityInfrastructure3D.tsx';
import { RealisticRackCabinet3D } from './RealisticGpuTray3D.tsx';

export type HeatmapMode = 'none' | 'gpuTemp' | 'power' | 'coolantTemp' | 'capacity';
export type CameraPreset = 'isometric' | 'topDown' | 'front' | 'side' | 'free';
export type RackViewMode = 'front' | 'rear' | 'close';

interface FacilitySceneProps {
  halls: HallConfig[];
  infrastructureZones: FacilityInfrastructureZone[];
  selection: SelectionState;
  simulationState: IntegratedEngineeringState;
  layers: LayerVisibilityState;
  heatmapMode: HeatmapMode;
  traceMode: 'none' | 'cooling' | 'electrical' | 'network';
  selectedTraceLoop: 'all' | 'primary' | 'secondary' | 'feedA' | 'feedB' | 'none';
  cameraPreset: CameraPreset;
  rackViewMode?: RackViewMode;
  isXrayMode: boolean;
  extendedTrayId?: string | null;
  allTraysOpen?: boolean;
  theme?: 'dark' | 'light';
  onSelectCampus: () => void;
  onSelectHall: (hallId: string) => void;
  onSelectRack: (rackId: string) => void;
  onSelectGpu: (gpuId: string) => void;
  onToggleExtendTray?: (gpuId: string) => void;
  onHoverComponent?: (compName: string | null) => void;
  onSelectComponent: (component: InfrastructureComponentRef) => void;
}

/**
 * Canvas texture generator for clean 3D industrial placards
 */
function createLabelTexture(text: string, subtext: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 504, 120);

  ctx.fillStyle = color;
  ctx.fillRect(4, 4, 12, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Segoe UI", Inter, sans-serif';
  ctx.fillText(text, 30, 52);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '20px "Segoe UI", Inter, sans-serif';
  ctx.fillText(subtext, 30, 92);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function SignPlacard({
  text,
  subtext,
  color,
  position,
  rotation = [0, 0, 0],
  width = 6.0,
  height = 1.4,
  onClick,
}: {
  text: string;
  subtext: string;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  onClick?: () => void;
}) {
  const texture = useMemo(() => createLabelTexture(text, subtext, color), [text, subtext, color]);

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.04]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * Data Hall Structure Enclosure Component
 */
function DataHall3D({
  hall,
  isSelected,
  selectedRackId,
  selectedGpuId,
  extendedTrayId,
  allTraysOpen,
  theme,
  simulationState,
  layers,
  heatmapMode,
  isXrayMode,
  onSelectHall,
  onSelectRack,
  onSelectGpu,
  onToggleExtendTray,
  onHoverComponent,
}: {
  hall: HallConfig;
  isSelected: boolean;
  selectedRackId: string | null;
  selectedGpuId: string | null;
  extendedTrayId: string | null;
  allTraysOpen?: boolean;
  theme: 'dark' | 'light';
  simulationState: IntegratedEngineeringState;
  layers: LayerVisibilityState;
  heatmapMode: HeatmapMode;
  isXrayMode: boolean;
  onSelectHall: (id: string) => void;
  onSelectRack: (id: string) => void;
  onSelectGpu: (id: string) => void;
  onToggleExtendTray?: (id: string) => void;
  onHoverComponent?: (compName: string | null) => void;
}) {
  const [w, h, d] = hall.dimensions;
  const [cx, cy, cz] = hall.center;

  return (
    <group position={[cx, cy, cz]}>
      {/* 1. Hall Raised Access Floor Plate */}
      {layers.floorsAndAisles && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w - 0.2, d - 0.2]} />
          <meshStandardMaterial
            color={theme === 'light' ? '#f8fafc' : '#0f172a'}
            metalness={0.5}
            roughness={0.4}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {/* 2. Hall Boundary Structural Glass Walls */}
      {layers.facilityEnvelope && (
        <group>
          {/* Glass Partition Panels */}
          <mesh position={[0, h * 0.45, -d / 2]}>
            <planeGeometry args={[w, h * 0.9]} />
            <meshStandardMaterial
              color={theme === 'light' ? '#94a3b8' : '#0f172a'}
              transparent
              opacity={0.15}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[0, h * 0.45, d / 2]}>
            <planeGeometry args={[w, h * 0.9]} />
            <meshStandardMaterial
              color={theme === 'light' ? '#94a3b8' : '#0f172a'}
              transparent
              opacity={0.15}
              roughness={0.1}
            />
          </mesh>

          {/* Illuminated Accent Boundary Lines */}
          <lineSegments position={[0, 0.02, 0]}>
            <edgesGeometry args={[new THREE.PlaneGeometry(w, d)]} />
            <lineBasicMaterial color={isSelected ? '#38bdf8' : hall.accentColor} linewidth={isSelected ? 4 : 2} />
          </lineSegments>
        </group>
      )}

      {/* 3. Structural Columns with Safety Bollards */}
      {layers.structuralColumns && (
        <group>
          {[
            [-w / 2 + 0.8, -d / 2 + 0.8],
            [w / 2 - 0.8, -d / 2 + 0.8],
            [-w / 2 + 0.8, d / 2 - 0.8],
            [w / 2 - 0.8, d / 2 - 0.8],
          ].map(([colX, colZ], idx) => (
            <mesh key={idx} position={[colX, h / 2, colZ]}>
              <boxGeometry args={[0.6, h, 0.6]} />
              <meshStandardMaterial color={theme === 'light' ? '#64748b' : '#334155'} metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Installed 42U Server Racks with Retractable 4U Compute Sleds */}
      {layers.racks &&
        hall.racks.map((rack) => (
          <RealisticRackCabinet3D
            key={rack.id}
            rack={rack}
            simulationState={simulationState}
            heatmapMode={heatmapMode}
            isXrayMode={isXrayMode}
            isSelected={selectedRackId === rack.id}
            selectedGpuId={selectedGpuId}
            extendedTrayId={extendedTrayId}
            allTraysOpen={allTraysOpen}
            theme={theme}
            onSelectRack={onSelectRack}
            onSelectGpu={onSelectGpu}
            onToggleExtendTray={onToggleExtendTray}
            onHoverComponent={onHoverComponent}
          />
        ))}

      {/* 5. Hall Entrance Sign Placard */}
      {layers.labelsAndAnnotations && (
        <SignPlacard
          text={hall.name}
          subtext={`${hall.workloadProfile} · 6 Racks · 36 GPUs`}
          color={hall.accentColor}
          position={[0, 4.2, d / 2 + 0.2]}
          width={7.5}
          height={1.5}
          onClick={() => onSelectHall(hall.id)}
        />
      )}
    </group>
  );
}

/**
 * Camera Navigation & Preset Interpolator
 */
function CameraController({
  cameraPreset,
  rackViewMode = 'front',
  selection,
  halls,
  extendedTrayId,
}: {
  cameraPreset: CameraPreset;
  rackViewMode?: RackViewMode;
  selection: SelectionState;
  halls: HallConfig[];
  extendedTrayId?: string | null;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const { targetPos, camPos } = useMemo(() => {
    // Top-down overhead floor map
    if (cameraPreset === 'topDown') {
      return { targetPos: new THREE.Vector3(0, 0, 0), camPos: new THREE.Vector3(0, 88, 0.01) };
    }
    // Front elevation
    if (cameraPreset === 'front') {
      return { targetPos: new THREE.Vector3(0, 2, 0), camPos: new THREE.Vector3(0, 18, 68) };
    }
    // Side profile
    if (cameraPreset === 'side') {
      return { targetPos: new THREE.Vector3(0, 2, 0), camPos: new THREE.Vector3(68, 18, 0) };
    }
    // Isometric camera view (optimal default)
    if (cameraPreset === 'isometric') {
      return { targetPos: new THREE.Vector3(0, 0, 0), camPos: new THREE.Vector3(48, 44, 56) };
    }

    // Contextual selection drilldown target for specific GPU
    if (selection.level === 'gpu' && selection.gpuId) {
      for (const h of halls) {
        for (const r of h.racks) {
          const g = r.gpus.find((gpu) => gpu.id === selection.gpuId);
          if (g) {
            const rx = r.position[0];
            const rz = r.position[2];
            const facing = r.facingZ > 0 ? 1 : -1;
            const gy = (g.slotU * 0.044) + 0.1;

            // Close-up angle focusing on the extracted compute tray
            return {
              targetPos: new THREE.Vector3(rx, gy + 0.04, rz + facing * 0.52),
              camPos: new THREE.Vector3(rx, gy + 0.45, rz + facing * 1.45),
            };
          }
        }
      }
    }

    // Contextual selection for Rack (with Front / Rear / Close-up presets)
    if (selection.level === 'rack' && selection.rackId) {
      for (const h of halls) {
        const r = h.racks.find((rack) => rack.id === selection.rackId);
        if (r) {
          const rx = r.position[0];
          const rz = r.position[2];
          const facing = r.facingZ > 0 ? 1 : -1;

          if (rackViewMode === 'rear') {
            return {
              targetPos: new THREE.Vector3(rx, 1.1, rz),
              camPos: new THREE.Vector3(rx, 1.6, rz - facing * 2.8),
            };
          }
          if (rackViewMode === 'close' || extendedTrayId) {
            return {
              targetPos: new THREE.Vector3(rx, 1.05, rz + facing * 0.42),
              camPos: new THREE.Vector3(rx, 1.75, rz + facing * 1.9),
            };
          }
          // Default front rack inspection view
          return {
            targetPos: new THREE.Vector3(rx, 1.1, rz),
            camPos: new THREE.Vector3(rx, 1.7, rz + facing * 2.8),
          };
        }
      }
    }

    if (selection.level === 'hall' && selection.hallId) {
      const h = halls.find((hall) => hall.id === selection.hallId);
      if (h) {
        return {
          targetPos: new THREE.Vector3(h.center[0], 1.5, h.center[2]),
          camPos: new THREE.Vector3(h.center[0], 22, h.center[2] + 24),
        };
      }
    }

    // Default facility framing
    return { targetPos: new THREE.Vector3(0, 0, 0), camPos: new THREE.Vector3(0, 52, 64) };
  }, [cameraPreset, rackViewMode, selection, halls, extendedTrayId]);

  useFrame(() => {
    if (controlsRef.current && cameraPreset !== 'free') {
      camera.position.lerp(camPos, 0.08);
      controlsRef.current.target.lerp(targetPos, 0.08);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      maxPolarAngle={cameraPreset === 'topDown' ? 0.001 : Math.PI * 0.48}
      minDistance={0.8}
      maxDistance={220}
      enableDamping
      dampingFactor={0.07}
    />
  );
}

/**
 * Master 3D Facility Scene
 */
export default function FacilityScene3D({
  halls,
  selection,
  simulationState,
  layers,
  heatmapMode,
  traceMode,
  selectedTraceLoop,
  cameraPreset,
  rackViewMode = 'front',
  isXrayMode,
  extendedTrayId = null,
  allTraysOpen = false,
  theme = 'dark',
  onSelectCampus,
  onSelectHall,
  onSelectRack,
  onSelectGpu,
  onToggleExtendTray,
  onHoverComponent,
  onSelectComponent,
}: FacilitySceneProps) {
  const isLight = theme === 'light';

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 42, position: [0, 52, 64], near: 0.3, far: 600 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onSelectCampus();
        }
      }}
    >
      <color attach="background" args={[isLight ? '#e2e8f0' : '#080c16']} />

      {/* Cinematic Balanced Lighting Rig */}
      <ambientLight intensity={isLight ? 1.25 : 1.1} color={isLight ? '#ffffff' : '#f8fafc'} />
      <directionalLight
        position={[40, 60, 50]}
        intensity={isLight ? 1.6 : 2.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[-40, 45, -50]}
        intensity={isLight ? 0.9 : 1.2}
        color={isLight ? '#e0f2fe' : '#ffffff'}
      />

      {/* Campus Concrete Base Slab & Floor Grid */}
      <gridHelper
        args={[180, 90, isLight ? '#94a3b8' : '#334155', isLight ? '#cbd5e1' : '#1e293b']}
        position={[0, 0.001, 0]}
      />
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[100, 0.2, 92]} />
        <meshStandardMaterial
          color={isLight ? '#f1f5f9' : '#0b1329'}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      {/* Central Concourse Walkway Corridor */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.0, 76]} />
        <meshStandardMaterial
          color={isLight ? '#e2e8f0' : '#1e293b'}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>

      {/* Central Walkway Safety Boundary Stripes */}
      {[-3.9, 3.9].map((sx) => (
        <mesh key={sx} position={[sx, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.15, 76]} />
          <meshBasicMaterial color={isLight ? '#0284c7' : '#38bdf8'} />
        </mesh>
      ))}

      {/* 4 Data Halls with 24 Server Cabinets and 144 H100 GPU Trays */}
      {halls.map((hall) => (
        <DataHall3D
          key={hall.id}
          hall={hall}
          isSelected={selection.hallId === hall.id}
          selectedRackId={selection.rackId}
          selectedGpuId={selection.gpuId}
          extendedTrayId={extendedTrayId}
          allTraysOpen={allTraysOpen}
          theme={theme}
          simulationState={simulationState}
          layers={layers}
          heatmapMode={heatmapMode}
          isXrayMode={isXrayMode}
          onSelectHall={onSelectHall}
          onSelectRack={onSelectRack}
          onSelectGpu={onSelectGpu}
          onToggleExtendTray={onToggleExtendTray}
          onHoverComponent={onHoverComponent}
        />
      ))}

      {/* Simultaneous Full Infrastructure Suite (Cooling, Power, Network, AGMD) */}
      <FacilityInfrastructure3D
        halls={halls}
        selection={selection}
        simulationState={simulationState}
        layers={layers}
        traceMode={traceMode}
        selectedTraceLoop={selectedTraceLoop}
        onSelectComponent={onSelectComponent}
      />

      {/* Orbit Controls & Camera Preset Controller */}
      <CameraController
        cameraPreset={cameraPreset}
        rackViewMode={rackViewMode}
        selection={selection}
        halls={halls}
        extendedTrayId={extendedTrayId}
      />
    </Canvas>
  );
}
