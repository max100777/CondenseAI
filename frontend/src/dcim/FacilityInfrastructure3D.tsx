import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  HallConfig,
  SelectionState,
  LayerVisibilityState,
  InfrastructureComponentRef,
} from './facilityData.ts';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';

interface InfrastructureProps {
  halls: HallConfig[];
  selection: SelectionState;
  simulationState: IntegratedEngineeringState;
  layers: LayerVisibilityState;
  traceMode: 'none' | 'cooling' | 'electrical' | 'network';
  selectedTraceLoop: 'all' | 'primary' | 'secondary' | 'feedA' | 'feedB' | 'none';
  onSelectComponent: (component: InfrastructureComponentRef) => void;
}

/**
 * Animated Pulse markers along 3D polyline paths to represent dynamic fluid or power flow
 */
function AnimatedFlowPath({
  points,
  color,
  lineWidth = 3,
  speed = 1.0,
  isActive = true,
  opacity = 0.85,
  isHighlighted = false,
  isDimmed = false,
  onClick,
}: {
  points: [number, number, number][];
  color: string;
  lineWidth?: number;
  speed?: number;
  isActive?: boolean;
  opacity?: number;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const pathCurve = useMemo(() => {
    const vectors = points.map((p) => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.1);
  }, [points]);

  const effectiveOpacity = isHighlighted ? 1.0 : isDimmed ? 0.12 : opacity;
  const effectiveWidth = isHighlighted ? lineWidth + 2 : lineWidth;

  useFrame(() => {
    if (pulseRef.current && isActive && speed > 0.01) {
      const u = ((Date.now() * 0.0006 * speed) % 1);
      const pos = pathCurve.getPointAt(u);
      pulseRef.current.position.copy(pos);
    }
  });

  return (
    <group onClick={(e) => {
      if (onClick) {
        e.stopPropagation();
        onClick();
      }
    }}>
      {/* Base Path Geometry */}
      <mesh>
        <tubeGeometry args={[pathCurve, Math.max(12, points.length * 6), effectiveWidth * 0.04, 8, false]} />
        <meshStandardMaterial
          color={isHighlighted ? '#ffffff' : color}
          emissive={color}
          emissiveIntensity={isHighlighted ? 0.9 : 0.3}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={effectiveOpacity}
        />
      </mesh>

      {/* Traveling Flow Pulse Sphere */}
      {isActive && speed > 0.01 && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[effectiveWidth * 0.09, 12, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={effectiveOpacity * 0.95} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Master Infrastructure 3D Rendering Component
 * Displays Liquid Cooling, Electrical A/B, Network Cabling, and Waste Heat recovery simultaneously
 */
export default function FacilityInfrastructure3D({
  halls,
  selection,
  simulationState,
  layers,
  traceMode,
  selectedTraceLoop,
  onSelectComponent,
}: InfrastructureProps) {
  const pumpSpeed = simulationState.hydraulics.pumpSpeedFraction;
  const isPumpActive = pumpSpeed > 0.05 && simulationState.hydraulics.pumpStatus === 'Normal';
  const totalKw = simulationState.electrical.facilityTotalPowerKw;
  const isPowerActive = totalKw > 5.0;

  // Active Tracing target inspection
  const selectedRack = useMemo(() => {
    if (selection.rackId) {
      for (const h of halls) {
        const r = h.racks.find((rack) => rack.id === selection.rackId);
        if (r) return r;
      }
    }
    if (selection.gpuId) {
      for (const h of halls) {
        for (const r of h.racks) {
          if (r.gpus.some((g) => g.id === selection.gpuId)) return r;
        }
      }
    }
    return null;
  }, [selection, halls]);

  // Determine if a specific subsystem is in solo or highlight mode
  const isCoolingHighlighted = traceMode === 'cooling' || selectedTraceLoop === 'primary' || selectedTraceLoop === 'secondary';
  const isElectricalHighlighted = traceMode === 'electrical' || selectedTraceLoop === 'feedA' || selectedTraceLoop === 'feedB';
  const isNetworkHighlighted = traceMode === 'network';

  const shouldDimCooling = (isElectricalHighlighted || isNetworkHighlighted) && !isCoolingHighlighted;
  const shouldDimElectrical = (isCoolingHighlighted || isNetworkHighlighted) && !isElectricalHighlighted;
  const shouldDimNetwork = (isCoolingHighlighted || isElectricalHighlighted) && !isNetworkHighlighted;

  return (
    <group>
      {/* ========================================================================= */}
      {/* 1. LIQUID COOLING INFRASTRUCTURE: PRIMARY & SECONDARY LOOPS                */}
      {/* ========================================================================= */}
      {layers.coolingPiping && (
        <group>
          {/* A. Central Primary Pump Station & CDU Header */}
          {layers.pumpsAndCdu && (
            <group
              position={[20, 0.6, -32]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectComponent({
                  id: 'CDU-PUMP-STATION-01',
                  type: 'CDU',
                  name: 'Primary CDU & Circulation Pump Station',
                  category: 'cooling',
                  position: [20, 0.6, -32],
                });
              }}
            >
              {/* Pump Skids (2x Dual Redundant) */}
              {[-1.2, 1.2].map((px) => (
                <group key={px} position={[px, 0.2, 0]}>
                  <mesh>
                    <cylinderGeometry args={[0.45, 0.5, 1.2, 16]} />
                    <meshStandardMaterial
                      color="#0284c7"
                      metalness={0.8}
                      roughness={0.2}
                      emissive={isPumpActive ? '#38bdf8' : '#000000'}
                      emissiveIntensity={isPumpActive ? 0.3 : 0}
                    />
                  </mesh>
                  {/* Motor housing */}
                  <mesh position={[0, 0.8, 0]}>
                    <cylinderGeometry args={[0.35, 0.35, 0.6, 16]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
                  </mesh>
                  {/* Discharge gauge */}
                  <mesh position={[0.4, 0.4, 0]} rotation={[0, 0, -Math.PI / 2]}>
                    <cylinderGeometry args={[0.1, 0.1, 0.2, 12]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
                  </mesh>
                </group>
              ))}
            </group>
          )}

          {/* B. Primary Supply Main Spine (Cyan: 28°C from CDU to North corridor & Central Spine) */}
          {layers.primarySupply && (
            <AnimatedFlowPath
              points={[
                [20, 0.6, -32], // CDU Discharge
                [20, 0.6, -20], // North Spine Header
                [0, 0.6, -20],  // Central Concourse Junction
                [0, 0.6, 0],    // Central Spine Center
                [0, 0.6, 20],   // South Central Spine
              ]}
              color="#06b6d4"
              lineWidth={4.5}
              speed={pumpSpeed * 1.6}
              isActive={isPumpActive && layers.flowAnimations}
              isHighlighted={isCoolingHighlighted}
              isDimmed={shouldDimCooling}
              onClick={() =>
                onSelectComponent({
                  id: 'PRIMARY-SUPPLY-MAIN',
                  type: 'PRIMARY_SUPPLY',
                  name: 'Primary Coolant Supply Main Header (28.0°C)',
                  category: 'cooling',
                  position: [0, 0.6, 0],
                })
              }
            />
          )}

          {/* C. Primary Return Main Spine (Orange: 39.5°C warm coolant to Plate HX) */}
          {layers.primaryReturn && (
            <AnimatedFlowPath
              points={[
                [0, 1.8, 20],   // South Return Junction
                [0, 1.8, 0],    // Central Return Spine
                [0, 1.8, -20],  // North Return Concourse
                [-20, 1.8, -20], // Header towards Heat Exchanger
                [-20, 1.8, -32], // Enters Counterflow Plate HX
              ]}
              color="#f97316"
              lineWidth={4.5}
              speed={pumpSpeed * 1.6}
              isActive={isPumpActive && layers.flowAnimations}
              isHighlighted={isCoolingHighlighted}
              isDimmed={shouldDimCooling}
              onClick={() =>
                onSelectComponent({
                  id: 'PRIMARY-RETURN-MAIN',
                  type: 'PRIMARY_RETURN',
                  name: 'Primary Coolant Return Header (39.5°C)',
                  category: 'cooling',
                  position: [0, 1.8, 0],
                })
              }
            />
          )}

          {/* D. Cooled Primary Coolant Return to CDU (Chilled water return loop after heat extraction) */}
          <AnimatedFlowPath
            points={[
              [-20, 0.6, -32], // Exits Plate HX
              [0, 0.6, -32],   // Crosses North Plant Service Line
              [20, 0.6, -32],  // Enters CDU Suction
            ]}
            color="#0284c7"
            lineWidth={3.5}
            speed={pumpSpeed * 1.4}
            isActive={isPumpActive && layers.flowAnimations}
            isHighlighted={isCoolingHighlighted}
            isDimmed={shouldDimCooling}
          />

          {/* E. Hall-Level & Rack-Level Coolant Distribution Branches */}
          {layers.rackCoolantBranches &&
            halls.map((h) => {
              const hx = h.center[0];
              const hz = h.center[2];
              const isTargetHall = selectedRack?.hallId === h.id;

              return (
                <group key={`cooling-${h.id}`}>
                  {/* Hall Distribution Supply Header */}
                  <AnimatedFlowPath
                    points={[
                      [0, 0.6, hz],
                      [hx, 0.6, hz],
                    ]}
                    color="#06b6d4"
                    lineWidth={3.2}
                    speed={pumpSpeed * 1.4}
                    isActive={isPumpActive && layers.flowAnimations}
                    isHighlighted={isCoolingHighlighted && isTargetHall}
                    isDimmed={shouldDimCooling}
                  />

                  {/* Hall Distribution Return Header */}
                  <AnimatedFlowPath
                    points={[
                      [hx, 1.8, hz],
                      [0, 1.8, hz],
                    ]}
                    color="#f97316"
                    lineWidth={3.2}
                    speed={pumpSpeed * 1.4}
                    isActive={isPumpActive && layers.flowAnimations}
                    isHighlighted={isCoolingHighlighted && isTargetHall}
                    isDimmed={shouldDimCooling}
                  />

                  {/* Individual 6 Rack Branch Connections */}
                  {h.racks.map((r) => {
                    const rx = r.position[0];
                    const rz = r.position[2];
                    const isTargetRack = selectedRack?.id === r.id;

                    return (
                      <group key={`rack-pipes-${r.id}`}>
                        {/* Rack Supply Branch */}
                        <AnimatedFlowPath
                          points={[
                            [rx, 0.6, hz],
                            [rx, 0.6, rz],
                            [rx, 1.0, rz - 0.4 * r.facingZ], // Enters bottom manifold
                          ]}
                          color="#06b6d4"
                          lineWidth={2.2}
                          speed={pumpSpeed * 1.2}
                          isActive={isPumpActive && layers.flowAnimations}
                          isHighlighted={isTargetRack}
                          isDimmed={shouldDimCooling || (isCoolingHighlighted && !isTargetRack && selectedRack !== null)}
                          onClick={() =>
                            onSelectComponent({
                              id: `MANIFOLD-IN-${r.code}`,
                              type: 'PRIMARY_SUPPLY',
                              name: `${r.id} Coolant Supply Manifold (28.0°C)`,
                              category: 'cooling',
                              hallId: h.id,
                              rackId: r.id,
                              position: [rx, 0.6, rz],
                            })
                          }
                        />

                        {/* Rack Return Branch */}
                        <AnimatedFlowPath
                          points={[
                            [rx, 1.6, rz - 0.4 * r.facingZ], // Exits top manifold
                            [rx, 1.8, rz],
                            [rx, 1.8, hz],
                          ]}
                          color="#f97316"
                          lineWidth={2.2}
                          speed={pumpSpeed * 1.2}
                          isActive={isPumpActive && layers.flowAnimations}
                          isHighlighted={isTargetRack}
                          isDimmed={shouldDimCooling || (isCoolingHighlighted && !isTargetRack && selectedRack !== null)}
                          onClick={() =>
                            onSelectComponent({
                              id: `MANIFOLD-OUT-${r.code}`,
                              type: 'PRIMARY_RETURN',
                              name: `${r.id} Coolant Return Manifold (39.5°C)`,
                              category: 'cooling',
                              hallId: h.id,
                              rackId: r.id,
                              position: [rx, 1.8, rz],
                            })
                          }
                        />
                      </group>
                    );
                  })}
                </group>
              );
            })}
        </group>
      )}

      {/* ========================================================================= */}
      {/* 2. SECONDARY HEAT RECOVERY & AGMD DESALINATION LOOP                       */}
      {/* ========================================================================= */}
      {layers.heatExchanger && (
        <group>
          {/* A. Counterflow Plate Heat Exchanger Assembly */}
          <group
            position={[-20, 1.2, -32]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectComponent({
                id: 'HX-PLATE-FRAME-01',
                type: 'HEAT_EXCHANGER',
                name: 'Counterflow Plate & Frame Heat Exchanger (85% Eff)',
                category: 'cooling',
                position: [-20, 1.2, -32],
              });
            }}
          >
            {/* Structural Exchanger Frame */}
            <mesh>
              <boxGeometry args={[1.6, 2.4, 3.2]} />
              <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Stainless Heat Transfer Plates */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.5, 2.2, 2.6]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.15} />
            </mesh>
          </group>

          {/* B. Secondary Loop to 15,000 L Thermal Buffer Tank */}
          {layers.secondaryLoop && (
            <AnimatedFlowPath
              points={[
                [-20, 1.2, -32],  // Exits HX Secondary Outlet (35.2°C)
                [-18.5, 1.2, -32],
                [-16.5, 1.8, -32], // Enters Thermal Buffer Tank
              ]}
              color="#10b981"
              lineWidth={3.8}
              speed={1.2}
              isActive={layers.flowAnimations}
              isHighlighted={isCoolingHighlighted}
              isDimmed={shouldDimCooling}
              onClick={() =>
                onSelectComponent({
                  id: 'SECONDARY-LOOP-OUT',
                  type: 'HEAT_EXCHANGER',
                  name: 'Secondary Heat Recovery Loop (35.2°C)',
                  category: 'cooling',
                  position: [-18, 1.2, -32],
                })
              }
            />
          )}

          {/* C. 15,000 L Thermal Buffer Storage Tank (Interactive Selection) */}
          {layers.bufferTank && (
            <group
              position={[-16.5, 1.6, -32]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectComponent({
                  id: 'TANK-THERMAL-BUFFER-01',
                  type: 'SECONDARY_BUFFER',
                  name: 'Secondary Thermal Buffer Storage Tank (15,000 L)',
                  category: 'cooling',
                  position: [-16.5, 1.6, -32],
                });
              }}
            >
              <mesh>
                <cylinderGeometry args={[1.6, 1.6, 3.2, 24]} />
                <meshStandardMaterial
                  color="#0369a1"
                  metalness={0.8}
                  roughness={0.2}
                  emissive="#0284c7"
                  emissiveIntensity={0.25}
                />
              </mesh>
              {/* Outer Insulation Shell Rings */}
              {[-1.0, 0, 1.0].map((ringY) => (
                <mesh key={ringY} position={[0, ringY, 0]}>
                  <cylinderGeometry args={[1.64, 1.64, 0.1, 24]} />
                  <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.1} />
                </mesh>
              ))}
            </group>
          )}

          {/* D. Feedwater supply line to AGMD Desalination Module */}
          {layers.feedwaterPiping && (
            <AnimatedFlowPath
              points={[
                [-16.5, 1.4, -32], // Draws from Buffer Tank
                [-16.5, 1.4, -28], // Routes to AGMD Module
                [-20, 1.4, -28],   // Enters Hot Feed Channel
              ]}
              color="#10b981"
              lineWidth={3.0}
              speed={1.0}
              isActive={layers.flowAnimations}
              isHighlighted={isCoolingHighlighted}
              isDimmed={shouldDimCooling}
              onClick={() =>
                onSelectComponent({
                  id: 'AGMD-FEED-LINE',
                  type: 'AGMD_MODULE',
                  name: 'AGMD Desalination Feedwater Intake (36.5°C)',
                  category: 'desalination',
                  position: [-18, 1.4, -28],
                })
              }
            />
          )}

          {/* E. Freshwater Distillate Collection Pipe */}
          {layers.freshwaterTank && (
            <AnimatedFlowPath
              points={[
                [-20, 0.8, -28], // Permeate collector channel
                [-20, 0.8, -34], // Drops into Distillate Collection Reservoir
              ]}
              color="#38bdf8"
              lineWidth={2.8}
              speed={0.8}
              isActive={layers.flowAnimations}
              isHighlighted={isCoolingHighlighted}
              isDimmed={shouldDimCooling}
              onClick={() =>
                onSelectComponent({
                  id: 'DISTILLATE-COLLECTOR',
                  type: 'DISTILLATE_TANK',
                  name: 'Clean Distillate Collection Reservoir (86.4 L/h)',
                  category: 'desalination',
                  position: [-20, 0.8, -34],
                })
              }
            />
          )}

          {/* F. Brine Reject Effluent Drainage Pipe */}
          {layers.brineDrain && (
            <AnimatedFlowPath
              points={[
                [-20, 0.4, -28], // Brine discharge from membrane cassette
                [-24, 0.4, -28], // Effluent drain line
                [-24, 0.4, -34], // Plant boundary discharge
              ]}
              color="#b45309"
              lineWidth={2.4}
              speed={0.6}
              isActive={layers.flowAnimations}
              isHighlighted={isCoolingHighlighted}
              isDimmed={shouldDimCooling}
              onClick={() =>
                onSelectComponent({
                  id: 'BRINE-REJECT-DRAIN',
                  type: 'BRINE_OUTLET',
                  name: 'Concentrated Brine Reject Stream (35.6 g/kg)',
                  category: 'desalination',
                  position: [-24, 0.4, -30],
                })
              }
            />
          )}
        </group>
      )}

      {/* ========================================================================= */}
      {/* 3. DUAL 415V 3-PHASE ELECTRICAL POWER DISTRIBUTION (FEED A & FEED B)       */}
      {/* ========================================================================= */}
      {layers.electricalDistribution && (
        <group>
          {/* A. 11 kV Substation Step-Down Transformer */}
          {layers.substation && (
            <group
              position={[-20, 1.2, 32]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectComponent({
                  id: 'SUBSTATION-XFR-11KV',
                  type: 'SUBSTATION_XFR',
                  name: '11 kV / 415 V Primary Substation Transformer',
                  category: 'electrical',
                  position: [-20, 1.2, 32],
                });
              }}
            >
              <mesh>
                <boxGeometry args={[4.2, 2.4, 3.6]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Cooling oil radiator fins */}
              {[-1.6, -0.8, 0, 0.8, 1.6].map((fx) => (
                <mesh key={fx} position={[fx, 0, 1.9]}>
                  <boxGeometry args={[0.2, 2.0, 0.3]} />
                  <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
                </mesh>
              ))}
              {/* High Voltage Bushing Insulators */}
              {[-1.0, 0, 1.0].map((bx) => (
                <mesh key={bx} position={[bx, 1.6, 0]}>
                  <cylinderGeometry args={[0.15, 0.22, 0.8, 12]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.2} />
                </mesh>
              ))}
            </group>
          )}

          {/* B. Main Switchgear & Distribution Units */}
          <group
            position={[-20, 1.4, 22]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectComponent({
                id: 'MAIN-SWITCHGEAR-A',
                type: 'MAIN_SWITCHGEAR',
                name: '415V Main Distribution Switchgear A',
                category: 'electrical',
                position: [-20, 1.4, 22],
              });
            }}
          >
            <mesh>
              <boxGeometry args={[3.8, 2.8, 1.6]} />
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>

          {/* C. Overhead Feed A Busway Trunk (Bright Yellow: elevation y = 2.8) */}
          {layers.feedA && (
            <AnimatedFlowPath
              points={[
                [-20, 1.6, 32],  // Transformer Feed
                [-20, 2.8, 22],  // Switchgear A
                [-10, 2.8, 22],  // Hall Distribution A
                [-10, 2.8, 0],   // Central West Busway
                [-10, 2.8, -20], // North West Busway
              ]}
              color="#eab308"
              lineWidth={4.0}
              speed={1.5}
              isActive={isPowerActive && layers.powerPulses}
              isHighlighted={isElectricalHighlighted}
              isDimmed={shouldDimElectrical}
              onClick={() =>
                onSelectComponent({
                  id: 'BUSWAY-TRUNK-FEED-A',
                  type: 'BUSWAY_A',
                  name: 'Overhead 415V Feed A Busway Trunk (Primary Path)',
                  category: 'electrical',
                  position: [-10, 2.8, 0],
                })
              }
            />
          )}

          {/* D. Overhead Feed B Busway Trunk (Warm Amber: elevation y = 3.2 for 2N separation) */}
          {layers.feedB && (
            <AnimatedFlowPath
              points={[
                [20, 1.6, 32],   // Central Genset / UPS Feed
                [20, 3.2, 22],   // Switchgear B
                [10, 3.2, 22],   // Hall Distribution B
                [10, 3.2, 0],    // Central East Busway
                [10, 3.2, -20],  // North East Busway
              ]}
              color="#f59e0b"
              lineWidth={4.0}
              speed={1.5}
              isActive={isPowerActive && layers.powerPulses}
              isHighlighted={isElectricalHighlighted}
              isDimmed={shouldDimElectrical}
              onClick={() =>
                onSelectComponent({
                  id: 'BUSWAY-TRUNK-FEED-B',
                  type: 'BUSWAY_B',
                  name: 'Overhead 415V Feed B Busway Trunk (2N Redundant Path)',
                  category: 'electrical',
                  position: [10, 3.2, 0],
                })
              }
            />
          )}

          {/* E. Hall-Level A/B Drops into Rack PDUs */}
          {halls.map((h) => {
            const isWest = h.center[0] < 0;
            const busX = isWest ? -10 : 10;

            return (
              <group key={`elec-${h.id}`}>
                {h.racks.map((r) => {
                  const rx = r.position[0];
                  const rz = r.position[2];
                  const isTargetRack = selectedRack?.id === r.id;

                  return (
                    <group key={`pdu-drops-${r.id}`}>
                      {/* Feed A Tap Whip into Rack PDU A */}
                      {layers.feedA && (
                        <AnimatedFlowPath
                          points={[
                            [busX, 2.8, rz],
                            [rx - 0.3, 2.8, rz],
                            [rx - 0.3, 1.2, rz], // Drops into vertical PDU A
                          ]}
                          color="#eab308"
                          lineWidth={2.0}
                          speed={1.2}
                          isActive={isPowerActive && layers.powerPulses}
                          isHighlighted={isTargetRack}
                          isDimmed={shouldDimElectrical || (isElectricalHighlighted && !isTargetRack && selectedRack !== null)}
                          onClick={() =>
                            onSelectComponent({
                              id: `PDU-A-${r.code}`,
                              type: 'PDU_A',
                              name: `${r.id} Rack PDU Feed A (415V 3-Phase)`,
                              category: 'electrical',
                              hallId: h.id,
                              rackId: r.id,
                              position: [rx - 0.3, 1.2, rz],
                            })
                          }
                        />
                      )}

                      {/* Feed B Tap Whip into Rack PDU B */}
                      {layers.feedB && (
                        <AnimatedFlowPath
                          points={[
                            [busX, 3.2, rz],
                            [rx + 0.3, 3.2, rz],
                            [rx + 0.3, 1.2, rz], // Drops into vertical PDU B
                          ]}
                          color="#f59e0b"
                          lineWidth={2.0}
                          speed={1.2}
                          isActive={isPowerActive && layers.powerPulses}
                          isHighlighted={isTargetRack}
                          isDimmed={shouldDimElectrical || (isElectricalHighlighted && !isTargetRack && selectedRack !== null)}
                          onClick={() =>
                            onSelectComponent({
                              id: `PDU-B-${r.code}`,
                              type: 'PDU_B',
                              name: `${r.id} Rack PDU Feed B (415V 3-Phase)`,
                              category: 'electrical',
                              hallId: h.id,
                              rackId: r.id,
                              position: [rx + 0.3, 1.2, rz],
                            })
                          }
                        />
                      )}
                    </group>
                  );
                })}
              </group>
            );
          })}
        </group>
      )}

      {/* ========================================================================= */}
      {/* 4. HIGH-SPEED NETWORK INFRASTRUCTURE (CORE SPINE, TRAYS & TOR SWITCHES)   */}
      {/* ========================================================================= */}
      {layers.networkInfrastructure && (
        <group>
          {/* A. Core Central Spine Switch Enclosure */}
          {layers.coreSpine && (
            <group
              position={[0, 4.4, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectComponent({
                  id: 'NET-CORE-SPINE-01',
                  type: 'CORE_SWITCH',
                  name: 'Hyperscale 800G Core Spine Network Switch',
                  category: 'network',
                  position: [0, 4.4, 0],
                });
              }}
            >
              <mesh>
                <boxGeometry args={[1.8, 1.2, 1.8]} />
                <meshStandardMaterial
                  color="#1e1b4b"
                  metalness={0.8}
                  roughness={0.2}
                  emissive="#a855f7"
                  emissiveIntensity={0.4}
                />
              </mesh>
            </group>
          )}

          {/* B. Central Overhead Cable Ladder Trays (Purple wire-mesh) */}
          {layers.cableTrays && (
            <group position={[0, 4.2, 0]}>
              <mesh>
                <boxGeometry args={[1.4, 0.15, 64]} />
                <meshStandardMaterial color="#581c87" metalness={0.7} roughness={0.3} wireframe />
              </mesh>
            </group>
          )}

          {/* C. Fiber Backbone Trunks to 4 Hall Distribution Leaf Switches */}
          {halls.map((h) => {
            const hx = h.center[0];
            const hz = h.center[2];
            const isTargetHall = selectedRack?.hallId === h.id;

            return (
              <group key={`net-${h.id}`}>
                {/* Hall Distribution Fiber Trunk */}
                <AnimatedFlowPath
                  points={[
                    [0, 4.4, 0],   // Core Spine
                    [0, 4.4, hz],  // Corridor Junction
                    [hx, 4.0, hz], // Hall Leaf Switch
                  ]}
                  color="#a855f7"
                  lineWidth={3.2}
                  speed={2.2}
                  isActive={layers.networkActivity}
                  isHighlighted={isNetworkHighlighted && isTargetHall}
                  isDimmed={shouldDimNetwork}
                  onClick={() =>
                    onSelectComponent({
                      id: `LEAF-SWITCH-${h.code}`,
                      type: 'LEAF_SWITCH',
                      name: `${h.name} Leaf Distribution Switch (400G)`,
                      category: 'network',
                      hallId: h.id,
                      position: [hx, 4.0, hz],
                    })
                  }
                />

                {/* Overhead Rack Row Ladder Tray */}
                {layers.cableTrays && (
                  <group position={[hx, 3.8, hz]}>
                    <mesh>
                      <boxGeometry args={[12, 0.1, 1.2]} />
                      <meshStandardMaterial color="#6b21a8" metalness={0.8} roughness={0.3} wireframe />
                    </mesh>
                  </group>
                )}

                {/* ToR Switch Drops into each of the 6 Racks */}
                {h.racks.map((r) => {
                  const rx = r.position[0];
                  const rz = r.position[2];
                  const isTargetRack = selectedRack?.id === r.id;

                  return (
                    <AnimatedFlowPath
                      key={`tor-${r.id}`}
                      points={[
                        [hx, 3.8, hz],
                        [rx, 3.8, rz],
                        [rx, 2.0, rz], // Drops into Top of Rack Switch at RU 42
                      ]}
                      color="#c084fc"
                      lineWidth={1.8}
                      speed={2.0}
                      isActive={layers.networkActivity}
                      isHighlighted={isTargetRack}
                      isDimmed={shouldDimNetwork || (isNetworkHighlighted && !isTargetRack && selectedRack !== null)}
                      onClick={() =>
                        onSelectComponent({
                          id: `TOR-SWITCH-${r.code}`,
                          type: 'TOR_SWITCH',
                          name: `${r.id} Top-of-Rack Switch (400G OSFP/QSFP-DD)`,
                          category: 'network',
                          hallId: h.id,
                          rackId: r.id,
                          position: [rx, 2.0, rz],
                        })
                      }
                    />
                  );
                })}
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}
