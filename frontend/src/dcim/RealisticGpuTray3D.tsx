import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RackConfig, GpuPlaceholder } from './facilityData.ts';
import type { IntegratedEngineeringState, GpuEntity } from './simulation/engineeringState.ts';
import { HeatmapMode } from './FacilityScene3D.tsx';

interface RealisticGpuTrayProps {
  gpu: GpuPlaceholder;
  simulationState: IntegratedEngineeringState;
  heatmapMode: HeatmapMode;
  isXrayMode: boolean;
  isSelected: boolean;
  isExtended: boolean;
  theme: 'dark' | 'light';
  onSelectGpu: (id: string) => void;
  onToggleExtend?: (id: string) => void;
  onHoverComponent?: (compName: string | null) => void;
}

/**
 * Detailed 3D Physical Accelerator Hardware Component (NVIDIA H100 SXM5 Form Factor)
 * Features:
 * - High-density PCB baseboard with gold edge contacts and surface-mount capacitor banks
 * - SXM5 interposer substrate
 * - Silicon compute die with polished bevel and laser-marked surface
 * - 8x HBM3 / HBM3e high-bandwidth stacked memory dies flanking the central compute die
 * - Heavy CNC machined electrolytic copper cold plate with micro-channel top lid and CondensAI badge
 * - 4 spring-loaded captive knurled thumbscrew retention posts
 * - Chrome / brass dripless quick-disconnect coolant inlet and outlet couplers
 * - Reinforced braided high-purity coolant tubing looping to the chassis hose management arm
 * - Multi-phase VRM power delivery stages with black ferrite inductors and MOSFET heatsinks
 * - 48V / 12V high-current busbar power input connectors
 */
export function RealisticGpuHardware3D({
  gpuEntity,
  heatmapMode,
  theme,
  isHovered,
  onHoverComponent,
}: {
  gpuEntity?: GpuEntity;
  heatmapMode: HeatmapMode;
  theme: 'dark' | 'light';
  isHovered: boolean;
  onHoverComponent?: (compName: string | null) => void;
}) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  const tempC = gpuEntity?.temperatureC ?? 48.0;
  const powerW = gpuEntity?.powerW ?? 650.0;
  const isThrottled = gpuEntity?.fault === 'ThermalThrottling';

  // Dynamic heat coloring if heatmap is active
  const coldPlateColor = useMemo(() => {
    if (heatmapMode === 'gpuTemp') {
      if (tempC < 45) return '#38bdf8';
      if (tempC < 60) return '#22c55e';
      if (tempC < 72) return '#eab308';
      if (tempC < 80) return '#f97316';
      return '#ef4444';
    }
    if (heatmapMode === 'power') {
      if (powerW < 400) return '#38bdf8';
      if (powerW < 550) return '#22c55e';
      if (powerW < 650) return '#eab308';
      return '#f97316';
    }
    // Default authentic CNC machined electrolytic copper
    return '#b45309';
  }, [heatmapMode, tempC, powerW]);

  const pcbColor = theme === 'light' ? '#065f46' : '#022c22';

  const handlePointer = (e: any, name: string) => {
    e.stopPropagation();
    setHoveredPart(name);
    if (onHoverComponent) onHoverComponent(name);
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredPart(null);
    if (onHoverComponent) onHoverComponent(null);
  };

  return (
    <group position={[0, 0.015, -0.05]}>
      {/* 1. MAIN CARRIER BASEBOARD PCB (High-density multilayer FR4) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.38, 0.006, 0.32]} />
        <meshStandardMaterial
          color={pcbColor}
          emissive={isHovered ? '#0284c7' : '#000000'}
          emissiveIntensity={isHovered ? 0.35 : 0.0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* Gold Edge Connector Fingers on Board Boundary */}
      <mesh position={[0, 0.0035, 0.155]}>
        <boxGeometry args={[0.32, 0.002, 0.01]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.0035, -0.155]}>
        <boxGeometry args={[0.32, 0.002, 0.01]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Surface Mount Decoupling Capacitor Arrays (Left & Right Banks) */}
      {[-0.15, 0.15].map((bankX, bIdx) => (
        <group key={`caps-${bIdx}`} position={[bankX, 0.005, 0]}>
          {[-0.1, -0.05, 0, 0.05, 0.1].map((capZ, cIdx) => (
            <mesh key={`c-${cIdx}`} position={[0, 0, capZ]}>
              <boxGeometry args={[0.018, 0.006, 0.012]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 2. SXM5 PACKAGE SUBSTRATE */}
      <mesh
        position={[0, 0.006, 0]}
        onPointerOver={(e) => handlePointer(e, 'SXM5 Accelerator Substrate')}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.13, 0.005, 0.11]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* 3. 8x HBM3 HIGH-BANDWIDTH STACKED MEMORY MODULES (Surrounding central die) */}
      {[-0.045, 0.045].map((hbmX, colIdx) => (
        <group key={`hbm-col-${colIdx}`} position={[hbmX, 0.01, 0]}>
          {[-0.036, -0.012, 0.012, 0.036].map((hbmZ, rowIdx) => (
            <mesh
              key={`hbm-${rowIdx}`}
              position={[0, 0, hbmZ]}
              onPointerOver={(e) => handlePointer(e, `HBM3 Stack 0${colIdx * 4 + rowIdx + 1} (80GB VRAM)`)}
              onPointerOut={handlePointerOut}
            >
              <boxGeometry args={[0.016, 0.006, 0.018]} />
              <meshStandardMaterial
                color={hoveredPart?.includes('HBM') ? '#38bdf8' : '#0f172a'}
                emissive={hoveredPart?.includes('HBM') ? '#0284c7' : '#000000'}
                emissiveIntensity={0.4}
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* 4. SILICON COMPUTE DIE (TSMC 4N FinFET monolithic GPU core) */}
      <mesh
        position={[0, 0.01, 0]}
        onPointerOver={(e) => handlePointer(e, `H100 Silicon Die (${tempC.toFixed(1)}°C)`)}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.052, 0.006, 0.065]} />
        <meshStandardMaterial
          color={isThrottled ? '#ef4444' : '#475569'}
          emissive={isThrottled ? '#b91c1c' : '#000000'}
          emissiveIntensity={isThrottled ? 0.6 : 0.0}
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>

      {/* 5. PRECISION CNC COPPER COLD PLATE (Mounted directly over package) */}
      <group
        position={[0, 0.022, 0]}
        onPointerOver={(e) => handlePointer(e, `Direct-to-Chip Copper Cold Plate (${(gpuEntity?.coldPlateTempC ?? 42).toFixed(1)}°C)`)}
        onPointerOut={handlePointerOut}
      >
        {/* Main Solid Copper Base Block with internal micro-fins */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.16, 0.018, 0.14]} />
          <meshStandardMaterial
            color={coldPlateColor}
            metalness={0.88}
            roughness={0.18}
          />
        </mesh>

        {/* Polished Nickel-Plated Top Lid */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.15, 0.003, 0.13]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* Engraved CondensAI Logo Badge */}
        <mesh position={[0, 0.012, 0]}>
          <boxGeometry args={[0.08, 0.002, 0.03]} />
          <meshStandardMaterial color="#0284c7" emissive="#38bdf8" emissiveIntensity={0.5} />
        </mesh>

        {/* 4 Spring-Loaded Captive Retention Screws on Cold Plate Corners */}
        {[
          [-0.065, -0.055],
          [0.065, -0.055],
          [-0.065, 0.055],
          [0.065, 0.055],
        ].map(([sx, sz], sIdx) => (
          <group key={`screw-${sIdx}`} position={[sx, 0.01, sz]}>
            {/* Threaded Post */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.016, 12]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Knurled Head */}
            <mesh position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.007, 0.007, 0.005, 12]} />
              <meshStandardMaterial color="#475569" metalness={0.95} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Quick-Disconnect Coolant Inlet Fitting (Cold Supply at 28°C) */}
        <group
          position={[-0.045, 0.015, -0.035]}
          onPointerOver={(e) => handlePointer(e, `Coolant Inlet QD (28.0°C · ${(gpuEntity?.coolantFlowKgS ? gpuEntity.coolantFlowKgS * 60 : 0.67).toFixed(2)} L/min)`)}
          onPointerOut={handlePointerOut}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.02, 16]} />
            <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
            <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* Quick-Disconnect Coolant Outlet Fitting (Warm Return at ~39.5°C) */}
        <group
          position={[0.045, 0.015, -0.035]}
          onPointerOver={(e) => handlePointer(e, `Coolant Outlet QD (${(gpuEntity?.coolantOutletTempC ?? 39.5).toFixed(1)}°C)`)}
          onPointerOut={handlePointerOut}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.02, 16]} />
            <meshStandardMaterial color="#ea580c" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
            <meshStandardMaterial color="#f97316" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* 6. FLEXIBLE BRAIDED COOLANT HOSES (Connecting Cold Plate to Chassis Rear Manifold) */}
      <group position={[0, 0.035, 0]}>
        {/* Inlet Hose (Cyan Supply) */}
        <mesh position={[-0.045, 0, -0.09]}>
          <cylinderGeometry args={[0.006, 0.006, 0.09, 12]} />
          <meshStandardMaterial color="#0284c7" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Outlet Hose (Orange Return) */}
        <mesh position={[0.045, 0, -0.09]}>
          <cylinderGeometry args={[0.006, 0.006, 0.09, 12]} />
          <meshStandardMaterial color="#ea580c" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* 7. MULTI-PHASE VRM POWER DELIVERY STAGES (Front Flank of GPU) */}
      <group
        position={[0, 0.012, 0.09]}
        onPointerOver={(e) => handlePointer(e, `16-Phase DrMOS Voltage Regulator (${(gpuEntity?.powerW ?? 650).toFixed(0)}W Load)`)}
        onPointerOut={handlePointerOut}
      >
        {/* Ferrite Core High-Current Inductors (Chokes) */}
        {[-0.09, -0.07, -0.05, -0.03, -0.01, 0.01, 0.03, 0.05, 0.07, 0.09].map((chokeX, ckIdx) => (
          <mesh key={`choke-${ckIdx}`} position={[chokeX, 0, 0]}>
            <boxGeometry args={[0.015, 0.012, 0.015]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* Aluminum VRM Heatsink Strip */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.22, 0.008, 0.02]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* 8. 48V HIGH-CURRENT POWER CONNECTORS (Rear of PCB) */}
      <group
        position={[0, 0.015, -0.135]}
        onPointerOver={(e) => handlePointer(e, '48V Dual Busbar Power Connector')}
        onPointerOut={handlePointerOut}
      >
        <mesh position={[-0.05, 0, 0]}>
          <boxGeometry args={[0.035, 0.018, 0.02]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.05, 0, 0]}>
          <boxGeometry args={[0.035, 0.018, 0.02]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Copper Contact Terminals */}
        <mesh position={[-0.05, 0, -0.01]}>
          <boxGeometry args={[0.02, 0.01, 0.005]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0.05, 0, -0.01]}>
          <boxGeometry args={[0.02, 0.01, 0.005]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 4U Compute Sled with Telescoping Retractable Rail Animation
 * Physical Features:
 * - Ball-bearing telescoping slide rails mounted on both sides
 * - Smooth physical sliding motion extending +0.68m forward
 * - Front server faceplate with cast aluminum handles, quick-release latches, status LEDs, and tray placard
 * - Internal hardware: RealisticGpuHardware3D (SXM5, Cold Plate, HBM3, VRMs, Coolant Lines)
 */
export function RealisticServerTray3D({
  gpu,
  simulationState,
  heatmapMode,
  isXrayMode,
  isSelected,
  isExtended,
  theme,
  onSelectGpu,
  onToggleExtend,
  onHoverComponent,
}: RealisticGpuTrayProps) {
  const trayGroupRef = useRef<THREE.Group>(null);
  const intermediateRailRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const gpuSim = simulationState.gpus[gpu.id];
  const isNormal = gpuSim?.operatingStatus === 'Normal';
  const isThrottled = gpuSim?.fault === 'ThermalThrottling';

  // Target extension: 0.70m forward when extended, 0 when retracted
  const targetExtension = isExtended ? 0.70 : 0.0;
  const currentExtensionRef = useRef(0.0);

  useFrame((_, delta) => {
    // Smooth physical damping animation for tray extension
    currentExtensionRef.current = THREE.MathUtils.damp(
      currentExtensionRef.current,
      targetExtension,
      8.0,
      delta
    );

    if (trayGroupRef.current) {
      // Local Z axis extends forward
      trayGroupRef.current.position.z = currentExtensionRef.current;
    }

    if (intermediateRailRef.current) {
      // Intermediate slide rail extends half distance
      intermediateRailRef.current.position.z = currentExtensionRef.current * 0.5;
    }
  });

  // Elevation inside 42U cabinet (y from -0.85 to 0.75m)
  const y = (gpu.slotU * 0.044) - 0.9;

  // Faceplate border / LED color
  const statusLedColor = isThrottled ? '#f59e0b' : isNormal ? '#22c55e' : '#ef4444';
  const chassisMetal = theme === 'light' ? '#cbd5e1' : '#1e293b';

  return (
    <group position={[0, y, 0]}>
      {/* 1. FIXED OUTER RACK RAILS (Attached permanently to the 42U rack frame) */}
      <group position={[0, 0, 0]}>
        {/* Left Rack Rail */}
        <mesh position={[-0.275, 0, 0]}>
          <boxGeometry args={[0.015, 0.03, 0.86]} />
          <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Right Rack Rail */}
        <mesh position={[0.275, 0, 0]}>
          <boxGeometry args={[0.015, 0.03, 0.86]} />
          <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* 2. TELESCOPING INTERMEDIATE SLIDE MEMBER (Extends 50% along rails) */}
      <group ref={intermediateRailRef} position={[0, 0, 0]}>
        {/* Left Intermediate Rail */}
        <mesh position={[-0.268, 0, 0]}>
          <boxGeometry args={[0.01, 0.024, 0.78]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* Right Intermediate Rail */}
        <mesh position={[0.268, 0, 0]}>
          <boxGeometry args={[0.01, 0.024, 0.78]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>

      {/* 3. RETRACTABLE CHASSIS SLED & GPU HARDWARE (Extends 100% forward) */}
      <group
        ref={trayGroupRef}
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectGpu(gpu.id);
          if (onToggleExtend) onToggleExtend(gpu.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* 4U Server Chassis Bottom Pan */}
        <mesh position={[0, -0.065, 0]}>
          <boxGeometry args={[0.52, 0.008, 0.82]} />
          <meshStandardMaterial
            color={chassisMetal}
            metalness={0.8}
            roughness={0.25}
            transparent={isXrayMode}
            opacity={isXrayMode ? 0.35 : 1.0}
          />
        </mesh>

        {/* Chassis Left & Right Side Walls */}
        <mesh position={[-0.256, 0, 0]}>
          <boxGeometry args={[0.008, 0.13, 0.82]} />
          <meshStandardMaterial
            color={chassisMetal}
            metalness={0.8}
            roughness={0.25}
            transparent={isXrayMode}
            opacity={isXrayMode ? 0.35 : 1.0}
          />
        </mesh>
        <mesh position={[0.256, 0, 0]}>
          <boxGeometry args={[0.008, 0.13, 0.82]} />
          <meshStandardMaterial
            color={chassisMetal}
            metalness={0.8}
            roughness={0.25}
            transparent={isXrayMode}
            opacity={isXrayMode ? 0.35 : 1.0}
          />
        </mesh>

        {/* Chassis Rear Bulkhead with Blind-Mate Connectors */}
        <mesh position={[0, 0, -0.41]}>
          <boxGeometry args={[0.52, 0.13, 0.01]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Inner Ball-Bearing Slide Rails (Fastened to Chassis Sides) */}
        <mesh position={[-0.261, 0, 0]}>
          <boxGeometry args={[0.008, 0.02, 0.8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0.261, 0, 0]}>
          <boxGeometry args={[0.008, 0.02, 0.8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* REAR HOSE MANAGEMENT ARM (IGUS Flexible Energy Chain Link) */}
        <group position={[0.18, 0.02, -0.38]}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.08, 0.025, 0.06]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
        </group>

        {/* FRONT SERVER FACEPLATE */}
        <group position={[0, 0, 0.415]}>
          {/* Main Bezel */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.54, 0.145, 0.015]} />
            <meshStandardMaterial
              color={isSelected ? '#0284c7' : hovered ? '#334155' : theme === 'light' ? '#e2e8f0' : '#0f172a'}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>

          {/* Hexagonal Airflow Perforated Center Inset */}
          <mesh position={[0, 0, 0.008]}>
            <boxGeometry args={[0.38, 0.11, 0.002]} />
            <meshStandardMaterial color="#020617" roughness={0.8} />
          </mesh>

          {/* Left & Right Aluminum Rack Extrusion Handles */}
          {[-0.235, 0.235].map((hx) => (
            <group key={`handle-${hx}`} position={[hx, 0, 0.025]}>
              <mesh>
                <boxGeometry args={[0.02, 0.11, 0.035]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
              </mesh>
              {/* Ejector Release Latch */}
              <mesh position={[0, -0.035, 0.015]}>
                <boxGeometry args={[0.014, 0.025, 0.01]} />
                <meshStandardMaterial color="#38bdf8" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          ))}

          {/* Status Diagnostic LEDs */}
          <group position={[-0.14, 0.035, 0.01]}>
            {/* Power LED */}
            <mesh position={[-0.015, 0, 0]}>
              <sphereGeometry args={[0.004, 12, 12]} />
              <meshBasicMaterial color={statusLedColor} />
            </mesh>
            {/* Activity Blue LED */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.004, 12, 12]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            {/* Network Amber LED */}
            <mesh position={[0.015, 0, 0]}>
              <sphereGeometry args={[0.004, 12, 12]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          </group>

          {/* Tray Unit Placard */}
          <group position={[0, -0.035, 0.01]}>
            <mesh>
              <planeGeometry args={[0.18, 0.025]} />
              <meshBasicMaterial color="#0b1120" />
            </mesh>
          </group>
        </group>

        {/* 4. ACTUAL DETAILED GPU HARDWARE ENGINE INSIDE CHASSIS */}
        <RealisticGpuHardware3D
          gpuEntity={gpuSim}
          heatmapMode={heatmapMode}
          theme={theme}
          isHovered={hovered}
          onHoverComponent={onHoverComponent}
        />
      </group>
    </group>
  );
}

/**
 * High-Fidelity 42U GPU Server Cabinet Component
 * Features:
 * - Sturdy structural steel corner posts with etched 1U-42U unit numbering
 * - Hexagonal mesh front door that smoothly swings open when the rack is selected
 * - Vertical rear/side stainless steel liquid cooling supply and return manifolds
 * - Dual vertical 0U rack PDUs A and B with colored phase indicators
 * - Top-of-Rack (ToR) 400G spine network switch
 * - Internal LED service illumination
 * - 6 fully retractable 4U GPU compute sleds
 */
export function RealisticRackCabinet3D({
  rack,
  simulationState,
  heatmapMode,
  isXrayMode,
  isSelected,
  selectedGpuId,
  extendedTrayId,
  allTraysOpen,
  theme,
  onSelectRack,
  onSelectGpu,
  onToggleExtendTray,
  onHoverComponent,
}: {
  rack: RackConfig;
  simulationState: IntegratedEngineeringState;
  heatmapMode: HeatmapMode;
  isXrayMode: boolean;
  isSelected: boolean;
  selectedGpuId: string | null;
  extendedTrayId: string | null;
  allTraysOpen?: boolean;
  theme: 'dark' | 'light';
  onSelectRack: (id: string) => void;
  onSelectGpu: (id: string) => void;
  onToggleExtendTray?: (id: string) => void;
  onHoverComponent?: (compName: string | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const frontDoorRef = useRef<THREE.Group>(null);

  // Animate front door swinging open 95 degrees when selected
  const targetDoorAngle = isSelected ? -Math.PI * 0.55 : 0.0;
  const currentDoorAngleRef = useRef(0.0);

  useFrame((_, delta) => {
    currentDoorAngleRef.current = THREE.MathUtils.damp(
      currentDoorAngleRef.current,
      targetDoorAngle,
      6.0,
      delta
    );
    if (frontDoorRef.current) {
      frontDoorRef.current.rotation.y = currentDoorAngleRef.current;
    }
  });

  const frameColor = isSelected ? '#0284c7' : hovered ? '#475569' : theme === 'light' ? '#334155' : '#0f172a';

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
      {/* 1. 42U STEEL RACK POSTS & HORIZONTAL TIE MEMBERS */}
      <group position={[0, 1.0, 0]}>
        {/* 4 Vertical Corner Structural Posts */}
        {[
          [-0.34, -0.48],
          [0.34, -0.48],
          [-0.34, 0.48],
          [0.34, 0.48],
        ].map(([px, pz], pIdx) => (
          <mesh key={`post-${pIdx}`} position={[px, 0, pz]}>
            <boxGeometry args={[0.035, 2.05, 0.035]} />
            <meshStandardMaterial
              color={frameColor}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        ))}

        {/* Top and Bottom Perimeter Tie Frames */}
        {[-1.0, 1.0].map((tieY, tIdx) => (
          <group key={`tie-${tIdx}`} position={[0, tieY, 0]}>
            <mesh position={[0, 0, -0.48]}>
              <boxGeometry args={[0.71, 0.04, 0.035]} />
              <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.48]}>
              <boxGeometry args={[0.71, 0.04, 0.035]} />
              <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[-0.34, 0, 0]}>
              <boxGeometry args={[0.035, 0.04, 0.96]} />
              <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[0.34, 0, 0]}>
              <boxGeometry args={[0.035, 0.04, 0.96]} />
              <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* Solid Side Sheet Metal Enclosures (Semi-transparent in X-Ray) */}
        {[-0.355, 0.355].map((sx, sIdx) => (
          <mesh key={`side-panel-${sIdx}`} position={[sx, 0, 0]}>
            <boxGeometry args={[0.008, 1.96, 0.96]} />
            <meshStandardMaterial
              color={theme === 'light' ? '#64748b' : '#1e293b'}
              metalness={0.7}
              roughness={0.3}
              transparent={isXrayMode || isSelected}
              opacity={isXrayMode ? 0.2 : isSelected ? 0.4 : 0.95}
            />
          </mesh>
        ))}

        {/* Rear Perforated Door with Cable Pass-throughs */}
        <mesh position={[0, 0, -0.495]}>
          <boxGeometry args={[0.67, 1.96, 0.008]} />
          <meshStandardMaterial
            color="#0b1120"
            metalness={0.8}
            roughness={0.4}
            transparent={isXrayMode || isSelected}
            opacity={isXrayMode ? 0.15 : isSelected ? 0.35 : 0.9}
          />
        </mesh>
      </group>

      {/* 2. SWINGING PERFORATED HEX-MESH FRONT DOOR */}
      <group
        ref={frontDoorRef}
        position={[-0.35, 1.0, 0.50]} // Hinge position at left front post
      >
        <group position={[0.335, 0, 0]}>
          {/* Door Perimeter Outer Frame */}
          <mesh>
            <boxGeometry args={[0.67, 1.98, 0.015]} />
            <meshStandardMaterial
              color={isSelected ? '#0284c7' : '#1e293b'}
              metalness={0.8}
              roughness={0.3}
              wireframe={isSelected}
              transparent
              opacity={isSelected ? 0.3 : 0.85}
            />
          </mesh>
          {/* Perforated Mesh Inset */}
          <mesh position={[0, 0, 0.002]}>
            <planeGeometry args={[0.58, 1.86]} />
            <meshStandardMaterial
              color="#020617"
              metalness={0.9}
              roughness={0.5}
              transparent
              opacity={isSelected ? 0.15 : 0.75}
            />
          </mesh>
          {/* Mechanical Lever Door Handle */}
          <mesh position={[0.28, 0, 0.015]}>
            <boxGeometry args={[0.02, 0.14, 0.02]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.15} />
          </mesh>
        </group>
      </group>

      {/* 3. DUAL VERTICAL 0U RACK PDUs ON REAR POSTS */}
      {/* PDU A (Feed A - Yellow) */}
      <group position={[-0.30, 1.0, -0.44]}>
        <mesh>
          <boxGeometry args={[0.038, 1.85, 0.045]} />
          <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
      {/* PDU B (Feed B - Amber) */}
      <group position={[0.30, 1.0, -0.44]}>
        <mesh>
          <boxGeometry args={[0.038, 1.85, 0.045]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>

      {/* 4. VERTICAL STAINLESS STEEL LIQUID COOLING MANIFOLDS */}
      {/* Primary Supply Manifold (Cyan Header at Rear Left) */}
      <group position={[-0.24, 1.0, -0.44]}>
        <mesh>
          <cylinderGeometry args={[0.016, 0.016, 1.85, 16]} />
          <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>
      {/* Primary Return Manifold (Orange Header at Rear Right) */}
      <group position={[0.24, 1.0, -0.44]}>
        <mesh>
          <cylinderGeometry args={[0.016, 0.016, 1.85, 16]} />
          <meshStandardMaterial color="#ea580c" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>

      {/* 5. TOP-OF-RACK (ToR) 400G NETWORK SWITCH AT RU 41-42 */}
      <group position={[0, 1.92, 0]}>
        <mesh>
          <boxGeometry args={[0.54, 0.075, 0.78]} />
          <meshStandardMaterial
            color="#1e1b4b"
            emissive="#a855f7"
            emissiveIntensity={0.35}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
        {/* Front QSFP-DD 400G Port Array with Active LEDs */}
        <mesh position={[0, 0, 0.395]}>
          <boxGeometry args={[0.48, 0.04, 0.008]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
      </group>

      {/* 6. INTERNAL LED SERVICE ILLUMINATION STRIP (Overhead) */}
      <mesh position={[0, 1.98, 0.1]}>
        <boxGeometry args={[0.45, 0.01, 0.02]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>

      {/* 7. SIX INDIVIDUAL RETRACTABLE 4U GPU COMPUTE TRAYS */}
      {rack.gpus.map((gpu) => {
        const isThisGpuSelected = selectedGpuId === gpu.id;
        const isThisTrayExtended = Boolean(
          allTraysOpen || extendedTrayId === gpu.id || (isSelected && isThisGpuSelected)
        );

        return (
          <RealisticServerTray3D
            key={gpu.id}
            gpu={gpu}
            simulationState={simulationState}
            heatmapMode={heatmapMode}
            isXrayMode={isXrayMode}
            isSelected={isThisGpuSelected}
            isExtended={isThisTrayExtended}
            theme={theme}
            onSelectGpu={onSelectGpu}
            onToggleExtend={onToggleExtendTray}
            onHoverComponent={onHoverComponent}
          />
        );
      })}

      {/* 8. RACK OVERHEAD TELEMETRY SIGN PLACARD */}
      <group position={[0, 2.22, 0]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.65, 0.42]} />
          <meshBasicMaterial
            color={isSelected ? '#0284c7' : theme === 'light' ? '#ffffff' : '#0b1120'}
          />
        </mesh>
        <lineSegments position={[0, 0, 0.005]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(1.65, 0.42)]} />
          <lineBasicMaterial color={isSelected ? '#38bdf8' : '#475569'} linewidth={2} />
        </lineSegments>
      </group>
    </group>
  );
}
