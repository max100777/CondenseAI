import React from 'react';
import { Cpu, Plus, Trash2, Play, RotateCcw } from 'lucide-react';
import { GPUConfig } from '../types';

interface Props {
  gpus: GPUConfig[];
  setGpus: React.Dispatch<React.SetStateAction<GPUConfig[]>>;
  enableAgmd: boolean;
  setEnableAgmd: (v: boolean) => void;
  durationS: number;
  setDurationS: (v: number) => void;
  timeStepS: number;
  setTimeStepS: (v: number) => void;
  onSimulate: () => void;
  onReset: () => void;
  loading: boolean;
}

export const MultiGPUControlPanel: React.FC<Props> = ({
  gpus,
  setGpus,
  enableAgmd,
  setEnableAgmd,
  durationS,
  setDurationS,
  timeStepS,
  setTimeStepS,
  onSimulate,
  onReset,
  loading,
}) => {
  const setPresetCount = (count: number) => {
    const newGpus: GPUConfig[] = [];
    for (let i = 1; i <= count; i++) {
      newGpus.push({
        gpu_id: `GPU-${i}`,
        power_w: count === 4 && i > 2 ? 250.0 : 350.0,
        heat_conversion_fraction: 0.95,
        initial_temp_c: 35.0,
        thermal_resistance_k_per_w: 0.12,
        thermal_capacitance_j_per_k: 250.0,
      });
    }
    setGpus(newGpus);
  };

  const updateGpu = (index: number, field: keyof GPUConfig, value: any) => {
    setGpus((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addGpu = () => {
    if (gpus.length >= 8) return;
    const nextId = `GPU-${gpus.length + 1}`;
    setGpus((prev) => [
      ...prev,
      {
        gpu_id: nextId,
        power_w: 350.0,
        heat_conversion_fraction: 0.95,
        initial_temp_c: 35.0,
        thermal_resistance_k_per_w: 0.12,
        thermal_capacitance_j_per_k: 250.0,
      },
    ]);
  };

  const removeGpu = (index: number) => {
    if (gpus.length <= 1) return;
    setGpus((prev) => prev.filter((_, i) => i !== index));
  };

  const totalPower = gpus.reduce((acc, g) => acc + (Number(g.power_w) || 0), 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Multi-GPU Scaling Control</h2>
            <p className="text-xs text-slate-400">Heterogeneous AI Cluster Waste-Heat Configuration</p>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Presets:</span>
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPresetCount(n)}
              className={`px-3 py-1 rounded-md font-medium border transition ${
                gpus.length === n
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {n} {n === 1 ? 'GPU' : 'GPUs'}
            </button>
          ))}
        </div>
      </div>

      {/* GPU Configuration Cards */}
      <div className="space-y-3 mb-6">
        {gpus.map((gpu, idx) => (
          <div
            key={gpu.gpu_id || idx}
            className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-[100px]">
              <span className="font-semibold text-indigo-300 text-sm">{gpu.gpu_id}</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Power (W):</label>
              <input
                type="number"
                min="0"
                max="5000"
                step="25"
                value={gpu.power_w}
                onChange={(e) => updateGpu(idx, 'power_w', parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">T_0 (°C):</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={gpu.initial_temp_c}
                onChange={(e) => updateGpu(idx, 'initial_temp_c', parseFloat(e.target.value) || 0)}
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">R_th (K/W):</label>
              <input
                type="number"
                min="0.01"
                max="2.0"
                step="0.01"
                value={gpu.thermal_resistance_k_per_w}
                onChange={(e) => updateGpu(idx, 'thermal_resistance_k_per_w', parseFloat(e.target.value) || 0.12)}
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">C_th (J/K):</label>
              <input
                type="number"
                min="50"
                max="5000"
                step="25"
                value={gpu.thermal_capacitance_j_per_k}
                onChange={(e) => updateGpu(idx, 'thermal_capacitance_j_per_k', parseFloat(e.target.value) || 250)}
                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-right text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => removeGpu(idx)}
              disabled={gpus.length <= 1}
              className={`p-1.5 rounded transition ${
                gpus.length <= 1
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/30'
              }`}
              title="Remove GPU"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {gpus.length < 8 && (
          <button
            onClick={addGpu}
            className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:text-indigo-300 hover:border-indigo-500/60 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add GPU (up to 8)
          </button>
        )}
      </div>

      {/* Global Controls & Simulation Run */}
      <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={enableAgmd}
              onChange={(e) => setEnableAgmd(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-600 focus:ring-0"
            />
            <span>Enable AGMD Distillation</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Duration (s):</span>
            <input
              type="number"
              min="10"
              max="3600"
              step="10"
              value={durationS}
              onChange={(e) => setDurationS(parseFloat(e.target.value) || 60)}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right text-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">dt (s):</span>
            <input
              type="number"
              min="0.1"
              max="5.0"
              step="0.5"
              value={timeStepS}
              onChange={(e) => setTimeStepS(parseFloat(e.target.value) || 1.0)}
              className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right text-slate-200"
            />
          </div>

          <div className="text-slate-400">
            Cluster Total: <span className="font-semibold text-indigo-400">{totalPower} W</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={onSimulate}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium text-xs transition flex items-center gap-2 ${
              loading
                ? 'bg-indigo-700 text-slate-300 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {loading ? 'Simulating Physics...' : 'Run Simulation'}
          </button>
        </div>
      </div>
    </div>
  );
};
