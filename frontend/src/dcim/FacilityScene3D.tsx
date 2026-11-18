import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  HallConfig,
  RackConfig,
  GpuPlaceholder,
  FacilityInfrastructureZone,
  SelectionState,
  LayerVisibilityState,
  InfrastructureComponentRef,
} from './facilityData.ts';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';
import FacilityInfrastructure3D from './FacilityInfrastructure3D.tsx';

export type HeatmapMode = 'none' | 'gpuTemp' | 'power' | 'coolantTemp' | 'capacity';
export type CameraPreset = 'isometric' | 'topDown' | 'front' | 'side' | 'free';

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
  isXrayMode: boolean;
  onSelectCampus: () => void;
  onSelectHall: (hallId: string) => void;
  onSelectRack: (rackId: string) => void;
  onSelectGpu: (gpuId: string) => void;
  onSelectComponent: (component: InfrastructureComponentRef) => void;
}

/**
 * Maps continuous temperature to a professional technical color
 */
function tempToColor(tempC: number): string {
  if (tempC < 45.0) return '#38bdf8'; // Cyan
  if (tempC < 65.0) return '#22c55e'; // Green
  if (tempC < 75.0) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

/**
 * Maps electrical power to color
 */
function powerToColor(powerW: number): string {
  if (powerW < 350) return '#38bdf8';
  if (powerW < 550) return '#22c55e';
  if (powerW < 650) return '#f59e0b';
  return '#ef4444';
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
 * Detailed 4U GPU Server Tray inside a 42U rack
 */
function GpuServerTray3D({
  gpu,
  simulationState,
  heatmapMode,
  isXrayMode,
  isSelected,
  onSelectGpu,
}: {
  gpu: GpuPlaceholder;
  simulationState: IntegratedEngineeringState;
  heatmapMode: HeatmapMode;
  isXrayMode: boolean;
  isSelected: boolean;
  onSelectGpu: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const gpuSim = simulationState.gpus[gpu.id];
  const tempC = gpuSim ? gpuSim.temperatureC : 45.0;
  const powerW = gpuSim ? gpuSim.powerW : 500.0;

  let trayColor = '#1e293b';
  let emissiveColor = '#000000';
  let emissiveIntensity = 0;

  if (heatmapMode === 'gpuTemp') {
    trayColor = tempToColor(tempC);
    emissiveColor = trayColor;
    emissiveIntensity = 0.55;
  } else if (heatmapMode === 'power') {
    trayColor = powerToColor(powerW);
    emissiveColor = trayColor;
    emissiveIntensity = 0.45;
  } else if (isSelected) {
    trayColor = '#0284c7';
    emissiveColor = '#38bdf8';
    emissiveIntensity = 0.7;
  } else if (hovered) {
    trayColor = '#334155';
    emissiveColor = '#0284c7';
    emissiveIntensity = 0.3;
  }

  // Elevation inside 42U cabinet (y from -0.85 to 0.75)
  const y = (gpu.slotU * 0.044) - 0.9;

  return (
    <group
      position={[0, y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectGpu(gpu.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 4U Server Chassis Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.56, 0.14, 0.88]} />
        <meshStandardMaterial
          color={trayColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          metalness={0.7}
          roughness={0.3}
          transparent={isXrayMode}
          opacity={isXrayMode ? 0.75 : 1.0}
        />
      </mesh>

      {/* Internal Copper Cold Plate Representation */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.34, 0.03, 0.36]} />
        <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Front Faceplate with Server Handle & LEDs */}
      <mesh position={[0, 0, 0.45]}>
        <boxGeometry args={[0.58, 0.15, 0.02]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Power LED Indicator */}
      <mesh position={[-0.22, 0, 0.465]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color={gpuSim?.operatingStatus === 'Normal' ? '#22c55e' : '#ef4444'} />
      </mesh>
    </group>
  );
}

/**
 * 42U Server Cabinet Component
 */
function ServerRackCabinet3D({
  rack,
  simulationState,
  heatmapMode,
  isXrayMode,
  isSelected,
  selectedGpuId,
  onSelectRack,
  onSelectGpu,
}: {
  rack: RackConfig;
  simulationState: IntegratedEngineeringState;
  heatmapMode: HeatmapMode;
  isXrayMode: boolean;
  isSelected: boolean;
  selectedGpuId: string | null;
  onSelectRack: (id: string) => void;
  onSelectGpu: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const rackSim = simulationState.racks[rack.id];
  const avgTemp = rackSim ? rackSim.averageGpuTempC : 45.0;

  const frameColor = isSelected ? '#0284c7' : hovered ? '#475569' : '#1e293b';

  return (
    <group
      position={rack.position}
      rotation={[0, rack.facingZ < 0 ? Math.PI : 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectRack(rack.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 42U Outer Sheet Metal Cabinet Enclosure */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.7, 2.0, 1.0]} />
        <meshStandardMaterial
          color={frameColor}
          metalness={0.8}
          roughness={0.25}
          wireframe={isXrayMode || isSelected}
          transparent={isXrayMode}
          opacity={isXrayMode ? 0.35 : 1.0}
        />
      </mesh>

      {/* Top of Rack (ToR) 400G Network Switch at RU 42 */}
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[0.58, 0.08, 0.85]} />
        <meshStandardMaterial
          color="#1e1b4b"
          emissive="#a855f7"
          emissiveIntensity={0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Dual Vertical Rack PDUs on Cabinet Sides */}
      {[-0.32, 0.32].map((pduX, pduIdx) => (
        <mesh key={pduX} position={[pduX, 1.0, -0.45]}>
          <boxGeometry args={[0.04, 1.8, 0.06]} />
          <meshStandardMaterial
            color={pduIdx === 0 ? '#eab308' : '#f59e0b'}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Interior 6 Discrete 4U Server Trays */}
      {rack.gpus.map((gpu) => (
        <GpuServerTray3D
          key={gpu.id}
          gpu={gpu}
          simulationState={simulationState}
          heatmapMode={heatmapMode}
          isXrayMode={isXrayMode}
          isSelected={selectedGpuId === gpu.id}
          onSelectGpu={onSelectGpu}
        />
      ))}

      {/* Rack Status Sign Placard Overhead */}
      <SignPlacard
        text={rack.id}
        subtext={`${(rackSim?.totalITPowerW || 3000) / 1000} kW · ${avgTemp.toFixed(1)}°C`}
        color={isSelected ? '#38bdf8' : '#64748b'}
        position={[0, 2.2, 0]}
        width={1.6}
        height={0.45}
      />
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
  simulationState,
  layers,
  heatmapMode,
  isXrayMode,
  onSelectHall,
  onSelectRack,
  onSelectGpu,
}: {
  hall: HallConfig;
  isSelected: boolean;
  selectedRackId: string | null;
  selectedGpuId: string | null;
  simulationState: IntegratedEngineeringState;
  layers: LayerVisibilityState;
  heatmapMode: HeatmapMode;
  isXrayMode: boolean;
  onSelectHall: (id: string) => void;
  onSelectRack: (id: string) => void;
  onSelectGpu: (id: string) => void;
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
            color="#0f172a"
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
            <meshStandardMaterial color="#0f172a" transparent opacity={0.2} roughness={0.1} />
          </mesh>
          <mesh position={[0, h * 0.45, d / 2]}>
            <planeGeometry args={[w, h * 0.9]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.2} roughness={0.1} />
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
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Installed 42U Server Racks */}
      {layers.racks &&
        hall.racks.map((rack) => (
          <ServerRackCabinet3D
            key={rack.id}
            rack={rack}
            simulationState={simulationState}
            heatmapMode={heatmapMode}
            isXrayMode={isXrayMode}
            isSelected={selectedRackId === rack.id}
            selectedGpuId={selectedGpuId}
            onSelectRack={onSelectRack}
            onSelectGpu={onSelectGpu}
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
  selection,
  halls,
}: {
  cameraPreset: CameraPreset;
  selection: SelectionState;
  halls: HallConfig[];
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

    // Contextual selection drilldown target
    if (selection.level === 'gpu' && selection.gpuId) {
      for (const h of halls) {
        for (const r of h.racks) {
          const g = r.gpus.find((gpu) => gpu.id === selection.gpuId);
          if (g) {
            const rx = r.position[0];
            const rz = r.position[2];
            const gy = (g.slotU * 0.044) + 0.1;
            const camZOffset = r.facingZ > 0 ? 2.2 : -2.2;
            return {
              targetPos: new THREE.Vector3(rx, gy, rz),
              camPos: new THREE.Vector3(rx, gy + 0.3, rz + camZOffset),
            };
          }
        }
      }
    }

    if (selection.level === 'rack' && selection.rackId) {
      for (const h of halls) {
        const r = h.racks.find((rack) => rack.id === selection.rackId);
        if (r) {
          const rx = r.position[0];
          const rz = r.position[2];
          const camZOffset = r.facingZ > 0 ? 3.8 : -3.8;
          return {
            targetPos: new THREE.Vector3(rx, 1.2, rz),
            camPos: new THREE.Vector3(rx, 2.4, rz + camZOffset),
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
  }, [cameraPreset, selection, halls]);

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
      minDistance={1.0}
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
  isXrayMode,
  onSelectCampus,
  onSelectHall,
  onSelectRack,
  onSelectGpu,
  onSelectComponent,
}: FacilitySceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 42, position: [0, 52, 64], near: 0.5, far: 600 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onSelectCampus();
        }
      }}
    >
      <color attach="background" args={['#080c16']} />

      {/* Cinematic Lighting Rig */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[40, 60, 50]} intensity={2.0} castShadow />
      <directionalLight position={[-40, 45, -50]} intensity={1.2} />

      {/* Campus Concrete Base Slab & Floor Grid */}
      <gridHelper args={[180, 90, '#334155', '#1e293b']} position={[0, 0.001, 0]} />
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[100, 0.2, 92]} />
        <meshStandardMaterial color="#0b1329" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Central Concourse Walkway Corridor */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.0, 76]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Central Walkway Safety Boundary Stripes */}
      {[-3.9, 3.9].map((sx) => (
        <mesh key={sx} position={[sx, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.15, 76]} />
          <meshBasicMaterial color="#38bdf8" />
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
          simulationState={simulationState}
          layers={layers}
          heatmapMode={heatmapMode}
          isXrayMode={isXrayMode}
          onSelectHall={onSelectHall}
          onSelectRack={onSelectRack}
          onSelectGpu={onSelectGpu}
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
        selection={selection}
        halls={halls}
      />
    </Canvas>
  );
}
