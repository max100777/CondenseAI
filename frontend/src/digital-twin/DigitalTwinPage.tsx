import React, { useState, useEffect, useRef } from 'react';
import { MultiGPUSimulationResponse, GPUConfig } from '../types';
import { CameraPreset, DisplayOptions, ComponentType } from './types';
import { useDigitalTwinData } from './hooks/useDigitalTwinData';
import { DigitalTwinScene } from './components/DigitalTwinScene';
import { DigitalTwinControls } from './components/DigitalTwinControls';
import { DigitalTwinLegend } from './components/DigitalTwinLegend';
import { ComponentInfoPanel } from './components/ComponentInfoPanel';
import { Play, Sparkles } from 'lucide-react';

const tour: {camera: CameraPreset; caption: string}[] = [
  {camera:'overview', caption:'Follow the two isolated fluid circuits from the GPU rack to the distillate collector.'},
  {camera:'gpu', caption:'Electrical power heats each GPU. Its cold plate transfers part of that heat into the circulating primary coolant.'},
  {camera:'hx', caption:'Heat crosses the exchanger plates into the saline loop. The primary coolant returns to the rack.'},
  {camera:'reservoir', caption:'The reservoir stores recovered heat and supplies warm saline feed to the membrane module.'},
  {camera:'agmd', caption:'Water evaporates at the warm membrane, crosses the air gap as vapor and condenses on the cold surface.'},
  {camera:'collector', caption:'Condensate drains into the collector. Its simulated volume accumulates over the run.'},
];

function grade(value: number, caution: number, critical: number) {
  if (value <= critical) return 'Critical';
  if (value <= caution) return 'Caution';
  return 'Normal';
}

interface Props {
  simulationResult: MultiGPUSimulationResponse | null;
  gpuConfigs: GPUConfig[];
  onRunSimulation: () => void;
  isLoading: boolean;
}

export const DigitalTwinPage: React.FC<Props> = ({
  simulationResult,
  gpuConfigs,
  onRunSimulation,
  isLoading,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [selectedComponent, setSelectedComponent] = useState<ComponentType | null>(null);

  // Fix 4: Thermal heatmap shader enabled by default for immediate physical feedback
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showLabels: false,
    showHeatmap: true,
    flowAnimation: true,
    agmdCutaway: false,
    transparentPipes: false, exploded: false, plates: false, energy: false,
  });

  const timeSeries = simulationResult?.time_series || [];
  const totalDuration = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].time_s : 0;

  // Use digital twin hook to extract current active step telemetry
  const { activeStep, telemetryState } = useDigitalTwinData(
    simulationResult,
    activeStepIndex
  );

  const currentTime = activeStep ? activeStep.time_s : 0;
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const stage = tourIndex === null ? null : tour[tourIndex];
  useEffect(() => {
    if (tourIndex === null) return;
    const timer = window.setTimeout(() => setTourIndex(tourIndex + 1 < tour.length ? tourIndex + 1 : null), 8500);
    return () => window.clearTimeout(timer);
  }, [tourIndex]);
  const params = simulationResult?.parameters;
  const configs: GPUConfig[] = params?.gpus ?? gpuConfigs;
  const health = activeStep ? [
    ...activeStep.gpu_states.map(g => {
      const limit = configs.find(c => c.gpu_id === g.gpu_id)?.max_temp_c ?? 90;
      return [g.gpu_id, grade(limit - g.current_temp_c, 5, 0), 'Temperature limit ' + limit + ' °C, caution within 5 °C'];
    }),
    ['Exchanger', grade(activeStep.hx_effectiveness, .5, .2), 'Effectiveness thresholds 0.50 and 0.20'],
    ['Reservoir', grade(activeStep.secondary_reservoir_temp_c - (params?.min_secondary_temp_c ?? 20), 3, 0), 'Caution within 3 °C of the minimum, critical at or below it'],
    ['AGMD', !params?.enable_agmd ? 'Off' : grade(activeStep.heat_to_agmd_w / (activeStep.heat_to_agmd_w + activeStep.unmet_agmd_demand_w || 1), .95, .1), 'Fraction of thermal demand supplied, thresholds 95% and 10%'],
  ] : [];

  // Fix 2: When a fresh simulation result arrives, reset to start and automatically begin playback
  useEffect(() => {
    if (timeSeries.length > 0) {
      setActiveStepIndex(0);
      setIsPlaying(true);
    }
  }, [simulationResult]);

  // Playback timer loop
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Correctly extract simulation dt (time_step_s) from parameters or timeSeries delta
  const simulationDt =
    simulationResult?.parameters?.time_step_s ??
    (timeSeries.length > 1 ? timeSeries[1].time_s - timeSeries[0].time_s : 1.0);

  useEffect(() => {
    if (!isPlaying || timeSeries.length <= 1) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = null;
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current != null) {
        const deltaSec = (time - lastTimeRef.current) / 1000;
        // Advance step fraction based on actual simulation dt and playback speed multiplier
        const stepsToAdvance = (deltaSec * playbackSpeed) / Math.max(0.001, simulationDt);

        setActiveStepIndex((prev) => {
          const next = prev + stepsToAdvance;
          // Stop automatically at the final timestep without crashing or looping prematurely
          if (next >= timeSeries.length - 1) {
            setIsPlaying(false);
            return timeSeries.length - 1;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, playbackSpeed, timeSeries.length, simulationDt]);

  const handleSeekTime = (time: number) => {
    if (timeSeries.length === 0) return;
    // Find closest valid historical step index
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < timeSeries.length; i++) {
      const diff = Math.abs(timeSeries[i].time_s - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    setActiveStepIndex(closestIdx);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // If paused at or near the end, restart from timestep 0
      if (activeStepIndex >= timeSeries.length - 1) {
        setActiveStepIndex(0);
      }
      setIsPlaying(true);
    }
  };

  const handleToggleOption = (key: keyof DisplayOptions) => {
    setDisplayOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Heat recovery and desalination</h2>
        <p className="mt-1 text-sm text-slate-600">Select a component to inspect its simulated operating conditions.</p>
      </header>
      <div className="flex flex-wrap items-center gap-3 p-4 text-xs">
        <button className="btn-primary" onClick={() => setTourIndex(stage ? null : 0)}>{stage ? 'End presentation' : 'Start guided presentation'}</button>
        {([['energy','Energy flow'],['transparentPipes','Transparent pipes'],['exploded','Exploded assemblies'],['plates','Exchanger plates']] as const).map(([key,label]) =>
          <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={displayOptions[key]} onChange={() => handleToggleOption(key)}/>{label}</label>)}
      </div>
      {stage && <p aria-live="polite" className="border-t bg-cyan-50 px-4 py-3 text-sm"><strong>{(tourIndex ?? 0)+1} / {tour.length}</strong> · {stage.caption}</p>}
      {health.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t p-3 text-xs"><strong>Simulated operating states</strong>{health.map(([name,state,reason]) =>
        <span key={name} title={reason} className={'rounded px-2 py-1 '+({Normal:'bg-emerald-100', Caution:'bg-amber-100', Critical:'bg-rose-200', Off:'bg-slate-100'}[state])}>{name} · {state}</span>)}</div>}
    <div className="relative isolate bg-slate-950">

      {/* Empty State Banner (Prompt to Run Simulation) */}
      {!simulationResult && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-4 shadow-2xl max-w-md text-center space-y-2 pointer-events-auto">
          <div className="flex items-center justify-center gap-2 text-cyan-400 font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Physics Visualization</span>
          </div>
          <p className="text-xs text-slate-300">
            Displaying the nominal system layout. Run a multi-GPU simulation to stream physical temperatures,
            counterflow enthalpy transfer, and real-time AGMD freshwater yields.
          </p>
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="mt-1 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isLoading ? 'Simulating Physics...' : 'Run Simulation'}</span>
          </button>
        </div>
      )}

      {/* 3D Scene Viewport */}
      <div className="h-[clamp(320px,52vh,600px)] w-full">
        <DigitalTwinScene
          telemetry={telemetryState}
          hasData={!!activeStep}
          gpuConfigs={configs}
          selectedComponent={selectedComponent}
          onSelectComponent={setSelectedComponent}
          cameraPreset={stage?.camera ?? cameraPreset}
          displayOptions={stage ? {...displayOptions, plates: stage.camera === 'hx', agmdCutaway: stage.camera === 'agmd', flowAnimation:true} : displayOptions}
        />
      </div>



      {/* Scientific Legend & Fluid Isolation HUD (Bottom-Left) */}
      <DigitalTwinLegend />

      {/* Interactive Component Inspector Panel (Right) */}
      <ComponentInfoPanel
        selectedComponent={selectedComponent}
        onClose={() => setSelectedComponent(null)}
        telemetry={telemetryState}
      />
    </div>
      {/* UI Controls Overlay (Left) */}
      <DigitalTwinControls
        cameraPreset={stage?.camera ?? cameraPreset}
        onSelectCamera={preset => {setTourIndex(null); setCameraPreset(preset);}}
        displayOptions={displayOptions}
        onToggleOption={handleToggleOption}
        currentTime={currentTime}
        totalDuration={totalDuration}
        onSeekTime={handleSeekTime}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        hasData={timeSeries.length > 0}
      />
    </section>
  );
};
