import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ComponentType, CameraPreset, DisplayOptions, TelemetryState } from '../types';
import { GPUConfig, GPUState } from '../../types';
import { CAMERA_PRESETS } from '../utils/spatialLayout';
import { acceleratorSlot, serviceExtension } from '../utils/acceleratorLayout';
import { GPUCluster3D } from './GPUCluster3D';
import { PlantStage } from './PlantStage';
import { PrimaryCoolantLoop3D } from './PrimaryCoolantLoop3D';
import { HeatExchanger3D } from './HeatExchanger3D';
import { SecondaryWaterLoop3D } from './SecondaryWaterLoop3D';
import { Reservoir3D } from './Reservoir3D';
import { AGMDModule3D } from './AGMDModule3D';
import { FreshwaterCollector3D } from './FreshwaterCollector3D';

interface Props {
  rackOpen: boolean;
  selectedGPU: string | null;
  onInspectGPU: (id:string) => void;
  onToggleRack: () => void;
  stepGPUs?: GPUState[];
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
  gpuIndex: number;
  cameraPreset: CameraPreset;
  controlsRef: React.RefObject<any>;
}> = ({ cameraPreset, controlsRef, gpuIndex }) => {
  const { camera, size } = useThree();
  const transitioning = useRef(true);
  const targetConfig = CAMERA_PRESETS[cameraPreset];
  const targetPos = useRef(new THREE.Vector3(...targetConfig.position));
  const targetLook = useRef(new THREE.Vector3(...targetConfig.target));

  useEffect(() => {
    const cfg = CAMERA_PRESETS[cameraPreset];
    targetPos.current.set(...cfg.position);
    targetLook.current.set(...cfg.target);
    if (cameraPreset === 'gpu' && gpuIndex >= 0) {
      const slot = acceleratorSlot(gpuIndex);
      targetLook.current.set(-5 + slot.x, slot.trayY+.15, serviceExtension+slot.z);
      targetPos.current.copy(targetLook.current).add(new THREE.Vector3(.55, 1.05, .92));
    }
    if (cameraPreset === 'overview' && camera instanceof THREE.PerspectiveCamera) {
      const verticalHalfAngle = THREE.MathUtils.degToRad(camera.fov / 2);
      const aspect = size.width / Math.max(1, size.height);
      const distance = 8.2 / (Math.tan(verticalHalfAngle) * aspect);
      targetPos.current.set(1.5, 3.6, Math.max(10.7, distance));
    }
    transitioning.current = true;
    const controls = controlsRef.current;
    const release = () => { transitioning.current = false; };
    controls?.addEventListener('start', release);
    return () => controls?.removeEventListener('start', release);
  }, [cameraPreset, size.width, size.height, camera, controlsRef, gpuIndex]);

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
  telemetry, hasData, rackOpen, selectedGPU, onInspectGPU, onToggleRack, stepGPUs,
  gpuConfigs,
  selectedComponent,
  onSelectComponent,
  cameraPreset,
  displayOptions,
}) => {
  const controlsRef = useRef<any>(null);

  // Map configs and current temperatures to GPUState list
  const gpuStates: GPUState[] = useMemo(() => {
    return stepGPUs ?? gpuConfigs.map((cfg, idx) => {
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
  }, [stepGPUs, gpuConfigs, telemetry.gpuTemperatures, telemetry.gpuHeatToCoolantW]);

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden select-none">
      <Canvas
        camera={{ position: [0.0, 3.5, 11.5], fov: 45 }}
        onPointerMissed={() => onSelectComponent(null)}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
      >
        <PlantStage />

        {/* Camera Controller & OrbitControls */}
        <CameraController cameraPreset={cameraPreset} controlsRef={controlsRef} gpuIndex={gpuStates.findIndex(gpu => gpu.gpu_id === selectedGPU)} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          minDistance={.8}
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
          selectedId={selectedGPU} open={rackOpen} onOpen={onToggleRack}
          onSelectGPU={onInspectGPU}
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
