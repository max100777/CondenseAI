import { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  AlertOctagon,
  Sliders,
  Clock,
  Sparkles,
  Zap,
  Droplets,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';

interface SimulationControlBarProps {
  simulationState: IntegratedEngineeringState;
  onTogglePlay: () => void;
  onReset: () => void;
  onStepForward: () => void;
  onSetSpeed: (speed: number) => void;
  onSetScenario: (scenario: string) => void;
  onInjectFault?: (faultType: string) => void;
}

export default function SimulationControlBar({
  simulationState,
  onTogglePlay,
  onReset,
  onStepForward,
  onSetSpeed,
  onSetScenario,
  onInjectFault,
}: SimulationControlBarProps) {
  const { clock, selectedWorkloadPreset } = simulationState;
  const [showFaultMenu, setShowFaultMenu] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const scenarios = [
    'AI Training Baseline',
    'High-Intensity Training Surge',
    'AI Inference Production',
    'Scientific HPC Simulation',
    'Eco-Water Recovery Optimization',
  ];

  const faults = [
    { id: 'PumpTrip', label: 'Coolant Pump Trip (Loss of Flow)', icon: Droplets, color: '#ef4444' },
    { id: 'ValvRestriction', label: 'Rack Header Valve Restriction', icon: Sliders, color: '#f59e0b' },
    { id: 'ThermalThrottling', label: 'Overheat Thermal Throttling Surge', icon: Flame, color: '#f97316' },
    { id: 'PduTrip', label: 'PDU Feed B Trip (Loss of 2N Redundancy)', icon: Zap, color: '#eab308' },
    { id: 'MembraneFouling', label: 'AGMD Membrane Fouling (Flux Drop)', icon: AlertOctagon, color: '#06b6d4' },
  ];

  return (
    <div className="dc-sim-control-bar">
      {/* 1. PLAYBACK STATE & TIME CLOCK */}
      <div className="dc-control-left">
        <button
          className={`dc-sim-btn play-pause ${clock.isRunning ? 'active' : ''}`}
          onClick={onTogglePlay}
          title={clock.isRunning ? 'Pause simulation' : 'Run simulation'}
        >
          {clock.isRunning ? <Pause size={15} /> : <Play size={15} />}
          <span>{clock.isRunning ? 'Pause' : 'Run'}</span>
        </button>

        <button
          className="dc-sim-btn"
          onClick={onStepForward}
          disabled={clock.isRunning}
          title="Advance 1 simulation step (+1.0s)"
        >
          <StepForward size={14} />
          <span>Step</span>
        </button>

        <button
          className="dc-sim-btn"
          onClick={onReset}
          title="Reset simulation time and thermal state"
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>

        <div className="dc-sim-clock">
          <Clock size={14} />
          <span>SIM T+</span>
          <strong>{formatTime(clock.simTimeSeconds)}</strong>
          <em>({clock.simTimeSeconds.toFixed(1)}s)</em>
        </div>
      </div>

      {/* 2. PLAYBACK SPEED SELECTOR */}
      <div className="dc-control-center">
        <span className="dc-label-speed">SPEED:</span>
        {[1, 2, 5].map((spd) => (
          <button
            key={spd}
            className={`dc-speed-btn ${clock.playbackSpeed === spd ? 'active' : ''}`}
            onClick={() => onSetSpeed(spd)}
          >
            {spd}×
          </button>
        ))}

        <div className="dc-control-divider" />

        {/* WORKLOAD SCENARIO SELECTOR */}
        <div className="dc-scenario-picker">
          <Sparkles size={14} style={{ color: '#38bdf8' }} />
          <span>Scenario:</span>
          <select
            value={selectedWorkloadPreset}
            onChange={(e) => onSetScenario(e.target.value)}
          >
            {scenarios.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. FAULT INJECTION & EXPERIMENT ACTIONS */}
      <div className="dc-control-right">
        <div className="dc-fault-trigger-wrapper">
          <button
            className={`dc-fault-menu-btn ${showFaultMenu ? 'active' : ''}`}
            onClick={() => setShowFaultMenu(!showFaultMenu)}
            title="Inject real-time operational failure"
          >
            <ShieldAlert size={14} />
            <span>Fault Injection</span>
          </button>

          {showFaultMenu && (
            <div className="dc-fault-dropdown">
              <div className="dc-dropdown-header">
                <AlertOctagon size={13} style={{ color: '#ef4444' }} />
                <strong>Simulate Failure Event</strong>
              </div>
              {faults.map((f) => (
                <button
                  key={f.id}
                  className="dc-fault-opt"
                  onClick={() => {
                    if (onInjectFault) onInjectFault(f.id);
                    setShowFaultMenu(false);
                  }}
                >
                  <f.icon size={13} style={{ color: f.color }} />
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
