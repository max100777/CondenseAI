import React from 'react';
import { CameraPreset, DisplayOptions } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Eye,
  Flame,
  Layers,
  Wind,
  Maximize2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface Props {
  cameraPreset: CameraPreset;
  onSelectCamera: (preset: CameraPreset) => void;
  displayOptions: DisplayOptions;
  onToggleOption: (key: keyof DisplayOptions) => void;
  currentTime: number;
  totalDuration: number;
  onSeekTime: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  hasData: boolean;
}

export const DigitalTwinControls: React.FC<Props> = ({
  cameraPreset,
  onSelectCamera,
  displayOptions,
  onToggleOption,
  currentTime,
  totalDuration,
  onSeekTime,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  hasData,
}) => {
  const cameraPresets: { id: CameraPreset; label: string }[] = [
    { id: 'overview', label: 'Full System' },
    { id: 'gpu', label: 'GPU Cluster' },
    { id: 'hx', label: 'Heat Exchanger' },
    { id: 'reservoir', label: 'Reservoir' },
    { id: 'agmd', label: 'AGMD Module' },
  ];

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 pointer-events-auto max-w-md">
      {/* 1. Camera Viewpoints Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-xl">
        <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          Views:
        </span>
        {cameraPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelectCamera(preset.id)}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              cameraPreset === preset.id
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* 2. Display Feature Toggles */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-2 flex items-center gap-2 shadow-xl">
        <button
          onClick={() => onToggleOption('showLabels')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
            displayOptions.showLabels
              ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Toggle 3D Labels"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Labels</span>
        </button>

        <button
          onClick={() => onToggleOption('showHeatmap')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
            displayOptions.showHeatmap
              ? 'bg-amber-950/60 border-amber-500 text-amber-300'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Toggle Thermal Heatmap Material"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Heatmap</span>
        </button>

        <button
          onClick={() => onToggleOption('flowAnimation')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
            displayOptions.flowAnimation
              ? 'bg-blue-950/60 border-blue-500 text-blue-300'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Toggle Flow & Vapor Particles"
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Flow</span>
        </button>

        <button
          onClick={() => onToggleOption('agmdCutaway')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
            displayOptions.agmdCutaway
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Toggle AGMD Cutaway View"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Cutaway</span>
        </button>
      </div>

      {/* 3. Time Playback & Scrubber (when simulation data is available) */}
      {hasData && totalDuration > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePlay}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>

              <button
                onClick={() => onSeekTime(0)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Restart (t = 0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSeekTime(Math.max(0, currentTime - totalDuration * 0.05))}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Step -5%"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onSeekTime(Math.min(totalDuration, currentTime + totalDuration * 0.05))}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Step +5%"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-right font-mono text-[11px] text-slate-300">
              <span className="text-cyan-400 font-bold">{currentTime.toFixed(1)}s</span> / {totalDuration.toFixed(1)}s
            </div>

            {/* Playback speed selector */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-md text-[10px] font-mono">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onChangeSpeed(speed)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === speed
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Time scrubber slider */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={totalDuration / 200 || 0.1}
              value={currentTime}
              onChange={(e) => onSeekTime(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
