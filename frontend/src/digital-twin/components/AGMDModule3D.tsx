import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { DisplayOptions } from '../types';
import { getTemperatureColor } from '../utils/temperatureColor';

interface Props {
  position?: [number, number, number];
  feedTempC: number;
  membraneHotTempC: number;
  membraneColdTempC: number;
  coldPlateTempC: number;
  vaporFluxLMH: number;
  salinityGKg: number;
  airGapThicknessMm?: number;
  isThrottled?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  displayOptions: DisplayOptions;
}

export const AGMDModule3D: React.FC<Props> = ({
  position = [5.2, 0.4, 0.0],
  feedTempC,
  membraneHotTempC,
  membraneColdTempC,
  coldPlateTempC,
  vaporFluxLMH,
  salinityGKg,
  airGapThicknessMm = 3.0,
  isThrottled = false,
  isSelected,
  onSelect,
  displayOptions,
}) => {
  const { showLabels, showHeatmap, agmdCutaway, flowAnimation } = displayOptions;

  const feedColor = getTemperatureColor(feedTempC);
  const memHotColor = getTemperatureColor(membraneHotTempC);
  const memColdColor = getTemperatureColor(membraneColdTempC);
  const coldPlateColor = getTemperatureColor(coldPlateTempC);

  // Vapor diffusion particles across the air gap
  const particleCount = 45;
  const particlesRef = useRef<THREE.Points>(null);

  const particlePositions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      pos[i * 3 + 0] = -0.06 + u * 0.12; // X spans gap
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.1; // Y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8; // Z
    }
    return pos;
  }, [particleCount]);

  useFrame((_, delta) => {
    if (!particlesRef.current || !flowAnimation || vaporFluxLMH <= 0.001) return;
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const speed = Math.min(0.25, Math.max(0.02, (vaporFluxLMH / 10.0) * 0.2)) * delta;

    for (let i = 0; i < particleCount; i++) {
      let x = positions[i * 3 + 0];
      x += speed;
      // Wrap around from membrane face (-0.06) to cold plate (0.06)
      if (x > 0.06) {
        x = -0.06;
      }
      positions[i * 3 + 0] = x;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Outer Chassis / Mounting Bracket */}
      <mesh position={[0, -0.75, 0]}>
        <boxGeometry args={[1.5, 0.1, 1.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Casing: In Cutaway mode, top and front are removed/opened */}
      {!agmdCutaway && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.1, 1.45, 1.1]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.7}
            roughness={0.3}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}

      {/* Layer 1: Hot Saline Feed Channel (Left, X = -0.22) */}
      <group position={[-0.22, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 1.3, 0.95]} />
          <meshStandardMaterial
            color={showHeatmap ? feedColor : '#0284c7'}
            metalness={0.2}
            roughness={0.1}
            transparent
            opacity={0.75}
            emissive={showHeatmap ? feedColor : '#0369a1'}
            emissiveIntensity={showHeatmap ? 0.35 : 0.15}
          />
        </mesh>
        {/* Feed Inlet Pipe from reservoir at top */}
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.15, 16]} />
          <meshStandardMaterial color={showHeatmap ? feedColor : '#0284c7'} metalness={0.7} />
        </mesh>
      </group>

      {/* Layer 2: Hydrophobic Microporous Membrane (PTFE) (X = -0.11) */}
      <group position={[-0.11, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.025, 1.3, 0.95]} />
          <meshStandardMaterial
            color={showHeatmap ? memHotColor : '#f8fafc'}
            metalness={0.1}
            roughness={0.9}
            transparent
            opacity={0.88}
          />
        </mesh>
        {/* Membrane mesh lattice pattern visual */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.026, 1.3, 0.95]} />
          <meshBasicMaterial color="#94a3b8" wireframe />
        </mesh>
      </group>

      {/* Layer 3: Stagnant Air Gap (X = 0.0) */}
      <group position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 1.3, 0.95]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.08}
            depthWrite={false}
          />
        </mesh>

        {/* Explanatory Vapor Diffusion Particles */}
        {vaporFluxLMH > 0.001 && (
          <points ref={particlesRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={particleCount}
                array={particlePositions}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial
              size={0.045}
              color="#38bdf8"
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}
      </group>

      {/* Layer 4: Cold Condensation Plate (X = +0.11) */}
      <group position={[0.11, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.04, 1.3, 0.95]} />
          <meshStandardMaterial
            color={showHeatmap ? coldPlateColor : '#1e3a8a'}
            metalness={0.9}
            roughness={0.2}
            emissive={showHeatmap ? coldPlateColor : '#1e3a8a'}
            emissiveIntensity={showHeatmap ? 0.2 : 0.1}
          />
        </mesh>
        {/* Condensed water film on cold face (facing gap at X = -0.021) */}
        <mesh position={[-0.021, 0, 0]}>
          <planeGeometry args={[0.94, 1.28]} />
          <meshStandardMaterial
            color={showHeatmap ? memColdColor : '#67e8f9'}
            metalness={0.1}
            roughness={0.05}
            transparent
            opacity={vaporFluxLMH > 0.01 ? 0.55 : 0.15}
          />
        </mesh>
      </group>

      {/* Layer 5: Condensate Drainage Trough (Bottom of gap & cold plate) */}
      <group position={[0.05, -0.68, 0]}>
        <mesh>
          <boxGeometry args={[0.22, 0.06, 0.95]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Drainage outlet pipe leading down to collector */}
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.25, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.8}
            metalness={0.5}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Selection Halo */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.15, 1.5, 1.15]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}

      {/* Live Engineering Labels */}
      {showLabels && (
        <Html position={[0, 0.95, 0]} center distanceFactor={8} pointerEvents="none">
          <div className="bg-slate-900/90 text-white text-[11px] px-2 py-1 rounded shadow-lg border border-slate-700 whitespace-nowrap backdrop-blur-sm pointer-events-none">
            <div className="font-semibold text-cyan-400 flex items-center justify-between gap-2">
              <span>AGMD Unit</span>
              {isThrottled && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/40">
                  Throttled
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-300 mt-0.5">
              <span>T_feed: <b className="text-white">{feedTempC.toFixed(1)}°C</b></span>
              <span>T_cold: <b className="text-white">{coldPlateTempC.toFixed(1)}°C</b></span>
              <span>T_mh: <b className="text-white">{membraneHotTempC.toFixed(1)}°C</b></span>
              <span>T_mc: <b className="text-white">{membraneColdTempC.toFixed(1)}°C</b></span>
              <span>Flux: <b className="text-cyan-300">{vaporFluxLMH.toFixed(2)} LMH</b></span>
              <span>Salinity: <b className="text-white">{salinityGKg.toFixed(1)} g/kg</b></span>
              <span>Gap: <b className="text-white">{airGapThicknessMm.toFixed(1)} mm</b></span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
