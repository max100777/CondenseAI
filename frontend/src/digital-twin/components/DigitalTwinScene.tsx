import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ComponentType, CameraPreset, DisplayOptions, TelemetryState } from '../types';
import { GPUConfig, GPUState } from '../../types';
import { CAMERA_PRESETS } from '../utils/spatialLayout';
import { GPUCluster3D } from './GPUCluster3D';
import { PrimaryCoolantLoop3D } from './PrimaryCoolantLoop3D';
import { HeatExchanger3D } from './HeatExchanger3D';
import { SecondaryWaterLoop3D } from './SecondaryWaterLoop3D';
import { Reservoir3D } from './Reservoir3D';
import { AGMDModule3D } from './AGMDModule3D';
import { FreshwaterCollector3D } from './FreshwaterCollector3D';

interface Props {
  hasData: boolean;
  telemetry: TelemetryState;
  gpuConfigs: GPUConfig[];
  selectedComponent: ComponentType | null;
  onSelectComponent: (component: ComponentType | null) => void;
  cameraPreset: CameraPreset;
  displayOptions: DisplayOptions;
}

type Point = [number, number, number];
function Flow({from, to, color}: {from: Point; to: Point; color: string}) {
  const marker = useRef<THREE.Mesh>(null);
  useFrame(({clock}) => {
    const t = (clock.elapsedTime * .7) % 1;
    marker.current?.position.set(from[0]+(to[0]-from[0])*t, from[1]+(to[1]-from[1])*t, from[2]+(to[2]-from[2])*t);
  });
  return <mesh ref={marker} rotation={[0,0,Math.atan2(to[1]-from[1],to[0]-from[0])-Math.PI/2]}>
    <coneGeometry args={[.105,.24,12]} /><meshBasicMaterial color={color}/>
  </mesh>;
}

// Camera transition controller
const CameraController: React.FC<{
  cameraPreset: CameraPreset;
  controlsRef: React.RefObject<any>;
}> = ({ cameraPreset, controlsRef }) => {
  const { camera, size } = useThree();
  const transitioning = useRef(true);
  const targetConfig = CAMERA_PRESETS[cameraPreset];
  const targetPos = useRef(new THREE.Vector3(...targetConfig.position));
  const targetLook = useRef(new THREE.Vector3(...targetConfig.target));

  useEffect(() => {
    const cfg = CAMERA_PRESETS[cameraPreset];
    targetPos.current.set(...cfg.position);
    targetLook.current.set(...cfg.target);
    if (cameraPreset === 'overview' && camera instanceof THREE.PerspectiveCamera) {
      const distance = 7.3 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * size.width / size.height);
      targetPos.current.set(1.5, 3.1, Math.max(7.8, distance));
    }
    transitioning.current = true;
    const controls = controlsRef.current;
    const release = () => { transitioning.current = false; };
    controls?.addEventListener('start', release);
    return () => controls?.removeEventListener('start', release);
  }, [cameraPreset, size.width, size.height, camera, controlsRef]);

  useFrame(() => {
    if (!transitioning.current) return;
    // Smooth lerp towards preset camera target
    camera.position.lerp(targetPos.current, 0.06);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.06);
      controlsRef.current.update();
      if (camera.position.distanceToSquared(targetPos.current) < 0.00001) transitioning.current = false;
    }
  });

  return null;
};

export const DigitalTwinScene: React.FC<Props> = ({
  telemetry, hasData,
  gpuConfigs,
  selectedComponent,
  onSelectComponent,
  cameraPreset,
  displayOptions,
}) => {
  const controlsRef = useRef<any>(null);

  // Map configs and current temperatures to GPUState list
  const gpuStates: GPUState[] = useMemo(() => {
    return gpuConfigs.map((cfg, idx) => {
      const temp = telemetry.gpuTemperatures[idx] ?? 50.0;
      return {
        gpu_id: cfg.gpu_id,
        current_temp_c: temp,
        power_w: cfg.power_w,
        heat_generated_w: cfg.power_w * cfg.heat_conversion_fraction,
        heat_to_coolant_w: (telemetry.gpuHeatToCoolantW / Math.max(1, gpuConfigs.length)) || (cfg.power_w * cfg.heat_conversion_fraction),
        net_heat_w: 0.0,
        stored_energy_j: cfg.thermal_capacitance_j_per_k * temp,
        status: temp >= 80 ? 'warning' : 'nominal',
      };
    });
  }, [gpuConfigs, telemetry.gpuTemperatures, telemetry.gpuHeatToCoolantW]);

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden select-none">
      <Canvas
        camera={{ position: [0.0, 3.5, 11.5], fov: 45 }}
        onPointerMissed={() => onSelectComponent(null)}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#132438']} />
        <hemisphereLight args={['#dcefff', '#6d8292', 1.2]} />

        {/* Ambient & Directional Lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 8]} intensity={1.2} castShadow />
        <directionalLight position={[-8, 6, -4]} intensity={0.5} />
        <pointLight position={[-1.4, 2, 2]} intensity={0.4} color="#38bdf8" />
        <pointLight position={[5.2, 2, 2]} intensity={0.4} color="#06b6d4" />

        {/* Studio Floor Grid */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0,-2.14,0]}>
          <planeGeometry args={[60,60]} />
          <meshStandardMaterial color="#22374b" roughness={0.95} />
        </mesh>
        <gridHelper args={[30, 30, '#52738b', '#354d63']} position={[0, -2.13, 0]} />

        {/* Camera Controller & OrbitControls */}
        <CameraController cameraPreset={cameraPreset} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          minDistance={2.5}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2 + 0.02}
        />

        {hasData && displayOptions.flowAnimation && <>
          <Flow from={[-4.2,.7,.2]} to={[-2,.7,.2]} color="#ffb897" />
          <Flow from={[-2,-.7,.2]} to={[-4.2,-.7,.2]} color="#7dd3fc" />
          <Flow from={[-.8,.7,-.2]} to={[.9,.7,-.2]} color="#ffd580" />
          <Flow from={[.9,-.7,-.2]} to={[-.8,-.7,-.2]} color="#67e8ad" />
          <Flow from={[2.7,.4,0]} to={[4.4,.4,0]} color="#ffd580" />
          {telemetry.freshwaterRateLh > 0 && <Flow from={[5.25,-.55,0]} to={[5.2,-1.2,0]} color="#93edff" />}
        </>}
        {hasData && displayOptions.energy && [
          [-3.1, 'GPU → coolant', telemetry.gpuHeatToCoolantW],
          [-1.4, 'Coolant → exchanger', telemetry.hxHeatTransferredW],
          [.25, 'Exchanger → reservoir', telemetry.hxHeatTransferredW],
          [3.55, 'Reservoir → AGMD', telemetry.agmdHeatExtractedW],
        ].map(([x, label, watts], i) => <Html key={label} position={[Number(x), i % 2 ? -.35 : .95, .5]} center style={{pointerEvents:'none'}}>
          <span className="block whitespace-nowrap rounded bg-slate-950/90 px-2 py-1 text-center text-[10px] text-white">{label}<br/>{Number(watts).toFixed(1)} W</span>
        </Html>)}
        {/* 1. GPU Cluster Chassis & Cold Plates */}
        <GPUCluster3D
          gpuStates={gpuStates}
          selectedId={selectedComponent === 'gpu' ? (gpuStates[0]?.gpu_id || 'GPU-1') : null}
          onSelectGPU={() => onSelectComponent('gpu')}
          showLabels={displayOptions.showLabels}
          showHeatmap={displayOptions.showHeatmap}
        />

        {/* 2. Primary Coolant Loop */}
        <PrimaryCoolantLoop3D transparent={displayOptions.transparentPipes}
          primaryTempC={telemetry.primaryOutletTempC}
          primaryOutletTempC={telemetry.primaryInletTempC}
          isSelected={selectedComponent === 'primary-loop' || selectedComponent === 'primary_loop'}
          onSelect={() => onSelectComponent('primary-loop')}
          showHeatmap={displayOptions.showHeatmap}
        />

        {/* 3. Counterflow Plate Heat Exchanger */}
        <HeatExchanger3D plates={displayOptions.plates} exploded={displayOptions.exploded}
          hxHeatTransferW={telemetry.hxHeatTransferredW}
          hxEffectiveness={telemetry.hxEffectiveness}
          primaryInletTempC={telemetry.primaryOutletTempC}
          primaryOutletTempC={telemetry.primaryInletTempC}
          secondaryInletTempC={telemetry.reservoirTempC}
          secondaryOutletTempC={telemetry.secondaryOutletTempC}
          isSelected={selectedComponent === 'hx'}
          onSelect={() => onSelectComponent('hx')}
          showHeatmap={displayOptions.showHeatmap}
          showLabels={displayOptions.showLabels}
        />

        {/* 4. Secondary Water Loop */}
        <SecondaryWaterLoop3D transparent={displayOptions.transparentPipes}
          secondaryOutletTempC={telemetry.secondaryOutletTempC}
          reservoirTempC={telemetry.reservoirTempC}
          isSelected={selectedComponent === 'secondary-loop' || selectedComponent === 'secondary_loop'}
          onSelect={() => onSelectComponent('secondary-loop')}
          showHeatmap={displayOptions.showHeatmap}
        />

        {/* 5. Thermal Storage Reservoir */}
        <Reservoir3D
          secondaryTempC={telemetry.reservoirTempC}
          storedEnergyJ={telemetry.reservoirEnergyJ}
          minTempC={20.0}
          isSelected={selectedComponent === 'reservoir'}
          onSelect={() => onSelectComponent('reservoir')}
          showHeatmap={displayOptions.showHeatmap}
          showLabels={displayOptions.showLabels}
        />

        {/* 6. AGMD Desalination Module */}
        <AGMDModule3D
          feedTempC={telemetry.agmdFeedTempC}
          membraneHotTempC={telemetry.agmdMembraneHotTempC}
          membraneColdTempC={telemetry.agmdMembraneColdTempC}
          coldPlateTempC={telemetry.agmdColdPlateTempC}
          vaporFluxLMH={telemetry.agmdVaporFluxLMH}
          salinityGKg={telemetry.agmdSalinityGKg}
          isThrottled={telemetry.agmdThrottled}
          isSelected={selectedComponent === 'agmd'}
          onSelect={() => onSelectComponent('agmd')}
          displayOptions={displayOptions}
        />

        {/* 7. Freshwater Collector */}
        <FreshwaterCollector3D
          cumulativeVolumeL={telemetry.freshwaterVolumeL}
          productionRateLh={telemetry.freshwaterRateLh}
          isSelected={selectedComponent === 'freshwater' || selectedComponent === 'collector'}
          onSelect={() => onSelectComponent('freshwater')}
          showLabels={displayOptions.showLabels}
        />
      </Canvas>
    </div>
  );
};
