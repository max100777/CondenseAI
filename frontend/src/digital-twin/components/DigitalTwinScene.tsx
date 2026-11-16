import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
  telemetry: TelemetryState;
  gpuConfigs: GPUConfig[];
  selectedComponent: ComponentType | null;
  onSelectComponent: (component: ComponentType | null) => void;
  cameraPreset: CameraPreset;
  displayOptions: DisplayOptions;
}

// Camera transition controller
const CameraController: React.FC<{
  cameraPreset: CameraPreset;
  controlsRef: React.RefObject<any>;
}> = ({ cameraPreset, controlsRef }) => {
  const { camera } = useThree();
  const targetConfig = CAMERA_PRESETS[cameraPreset];
  const targetPos = useRef(new THREE.Vector3(...targetConfig.position));
  const targetLook = useRef(new THREE.Vector3(...targetConfig.target));

  useEffect(() => {
    const cfg = CAMERA_PRESETS[cameraPreset];
    targetPos.current.set(...cfg.position);
    targetLook.current.set(...cfg.target);
  }, [cameraPreset]);

  useFrame(() => {
    // Smooth lerp towards preset camera target
    camera.position.lerp(targetPos.current, 0.06);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, 0.06);
      controlsRef.current.update();
    }
  });

  return null;
};

export const DigitalTwinScene: React.FC<Props> = ({
  telemetry,
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
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 15, 30]} />

        {/* Ambient & Directional Lighting */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 8]} intensity={1.2} castShadow />
        <directionalLight position={[-8, 6, -4]} intensity={0.5} />
        <pointLight position={[-1.4, 2, 2]} intensity={0.4} color="#38bdf8" />
        <pointLight position={[5.2, 2, 2]} intensity={0.4} color="#06b6d4" />

        {/* Studio Floor Grid */}
        <gridHelper args={[30, 30, '#1e293b', '#0f172a']} position={[0, -2.1, 0]} />

        {/* Camera Controller & OrbitControls */}
        <CameraController cameraPreset={cameraPreset} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          minDistance={2.5}
          maxDistance={22}
          maxPolarAngle={Math.PI / 2 + 0.02}
        />

        {/* 1. GPU Cluster Chassis & Cold Plates */}
        <GPUCluster3D
          gpuStates={gpuStates}
          selectedId={selectedComponent === 'gpu' ? (gpuStates[0]?.gpu_id || 'GPU-1') : null}
          onSelectGPU={() => onSelectComponent('gpu')}
          showLabels={displayOptions.showLabels}
          showHeatmap={displayOptions.showHeatmap}
        />

        {/* 2. Primary Coolant Loop */}
        <PrimaryCoolantLoop3D
          primaryTempC={telemetry.primaryOutletTempC}
          primaryOutletTempC={telemetry.primaryInletTempC}
          isSelected={selectedComponent === 'primary-loop' || selectedComponent === 'primary_loop'}
          onSelect={() => onSelectComponent('primary-loop')}
          showHeatmap={displayOptions.showHeatmap}
        />

        {/* 3. Counterflow Plate Heat Exchanger */}
        <HeatExchanger3D
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
        <SecondaryWaterLoop3D
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
