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
    <section className="panel">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-50 p-2 text-cyan-800">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="panel-heading">Simulation configuration</h2>
            <p className="panel-subtitle">Configure the GPU cluster and numerical time domain for this analysis.</p>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <span className="field-label">Cluster preset</span>
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPresetCount(n)}
              className={`px-3 py-1 rounded-md font-medium border transition ${
                gpus.length === n
                  ? 'border-cyan-800 bg-cyan-800 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
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
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5"
          >
            <div className="flex items-center gap-2 min-w-[100px]">
              <span className="text-sm font-semibold text-slate-800">{gpu.gpu_id}</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="field-label">Power (W)</label>
              <input
                type="number"
                min="0"
                max="5000"
                step="25"
                value={gpu.power_w}
                onChange={(e) => updateGpu(idx, 'power_w', parseFloat(e.target.value) || 0)}
                className="field-input w-20"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="field-label">T₀ (°C)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={gpu.initial_temp_c}
                onChange={(e) => updateGpu(idx, 'initial_temp_c', parseFloat(e.target.value) || 0)}
                className="field-input w-16"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="field-label">Rth (K/W)</label>
              <input
                type="number"
                min="0.01"
                max="2.0"
                step="0.01"
                value={gpu.thermal_resistance_k_per_w}
                onChange={(e) => updateGpu(idx, 'thermal_resistance_k_per_w', parseFloat(e.target.value) || 0.12)}
                className="field-input w-16"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="field-label">Cth (J/K)</label>
              <input
                type="number"
                min="50"
                max="5000"
                step="25"
                value={gpu.thermal_capacitance_j_per_k}
                onChange={(e) => updateGpu(idx, 'thermal_capacitance_j_per_k', parseFloat(e.target.value) || 250)}
                className="field-input w-20"
              />
            </div>

            <button
              onClick={() => removeGpu(idx)}
              disabled={gpus.length <= 1}
              className={`p-1.5 rounded transition ${
                gpus.length <= 1
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-400 hover:bg-rose-50 hover:text-rose-700'
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
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 transition hover:border-cyan-700 hover:text-cyan-800"
          >
            <Plus className="w-4 h-4" /> Add GPU (up to 8)
          </button>
        )}
      </div>

      {/* Global Controls & Simulation Run */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={enableAgmd}
              onChange={(e) => setEnableAgmd(e.target.checked)}
              className="rounded border-slate-300 text-cyan-800 focus:ring-0"
            />
            <span>Enable AGMD Distillation</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="field-label">Duration (s)</span>
            <input
              type="number"
              min="10"
              max="3600"
              step="10"
              value={durationS}
              onChange={(e) => setDurationS(parseFloat(e.target.value) || 60)}
              className="field-input w-16"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="field-label">dt (s)</span>
            <input
              type="number"
              min="0.1"
              max="5.0"
              step="0.5"
              value={timeStepS}
              onChange={(e) => setTimeStepS(parseFloat(e.target.value) || 1.0)}
              className="field-input w-14"
            />
          </div>

          <div className="text-slate-500">
            Cluster total: <span className="font-semibold text-slate-800">{totalPower} W</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            disabled={loading}
            className="btn-secondary"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={onSimulate}
            disabled={loading}
            className="btn-primary"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {loading ? 'Simulating Physics...' : 'Run Simulation'}
          </button>
        </div>
      </div>
    </section>
  );
};
