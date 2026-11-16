import React, { useState, useEffect, useRef } from 'react';
import { MultiGPUSimulationResponse, GPUConfig } from '../types';
import { CameraPreset, DisplayOptions, ComponentType } from './types';
import { useDigitalTwinData } from './hooks/useDigitalTwinData';
import { DigitalTwinScene } from './components/DigitalTwinScene';
import { DigitalTwinControls } from './components/DigitalTwinControls';
import { DigitalTwinLegend } from './components/DigitalTwinLegend';
import { ComponentInfoPanel } from './components/ComponentInfoPanel';
import { Play, Sparkles } from 'lucide-react';

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
    showLabels: true,
    showHeatmap: true,
    flowAnimation: true,
    agmdCutaway: false,
  });

  const timeSeries = simulationResult?.time_series || [];
  const totalDuration = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].time_s : 0;

  // Use digital twin hook to extract current active step telemetry
  const { activeStep, telemetryState } = useDigitalTwinData(
    simulationResult,
    activeStepIndex
  );

  const currentTime = activeStep ? activeStep.time_s : 0;

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
    <div className="relative w-full h-[calc(100vh-4.5rem)] min-h-[640px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Banner / System Breadcrumbs */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/60 shadow-lg text-xs text-slate-300">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="font-semibold text-white">CondensAI 3D Digital Twin</span>
        <span className="text-slate-500">|</span>
        <span className="font-mono text-cyan-300">
          GPU Waste Heat → Counterflow HX → Thermal Reservoir → AGMD Distillation
        </span>
      </div>

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
      <div className="w-full h-full flex-1">
        <DigitalTwinScene
          telemetry={telemetryState}
          gpuConfigs={gpuConfigs}
          selectedComponent={selectedComponent}
          onSelectComponent={setSelectedComponent}
          cameraPreset={cameraPreset}
          displayOptions={displayOptions}
        />
      </div>

      {/* UI Controls Overlay (Left) */}
      <DigitalTwinControls
        cameraPreset={cameraPreset}
        onSelectCamera={setCameraPreset}
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

      {/* Scientific Legend & Fluid Isolation HUD (Bottom-Left) */}
      <DigitalTwinLegend />

      {/* Interactive Component Inspector Panel (Right) */}
      <ComponentInfoPanel
        selectedComponent={selectedComponent}
        onClose={() => setSelectedComponent(null)}
        telemetry={telemetryState}
      />
    </div>
  );
};
