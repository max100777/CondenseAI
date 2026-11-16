import React, { useState, useEffect } from 'react';
import { Droplets, Box, BarChart3 } from 'lucide-react';
import { GPUConfig, MultiGPUSimulationResponse } from './types';
import { MultiGPUControlPanel } from './components/MultiGPUControlPanel';
import { WaterProductionOverview } from './components/WaterProductionOverview';
import { ThermalEfficiencyDashboard } from './components/ThermalEfficiencyDashboard';
import { GPUComparisonView } from './components/GPUComparisonView';
import { TimeSeriesCharts } from './components/TimeSeriesCharts';
import { ScalingComparisonView } from './components/ScalingComparisonView';
import { DigitalTwinPage } from './digital-twin/DigitalTwinPage';

type ActiveTab = '3d' | 'analytics';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('3d');

  const [gpus, setGpus] = useState<GPUConfig[]>([
    {
      gpu_id: 'GPU-1',
      power_w: 350.0,
      heat_conversion_fraction: 0.95,
      initial_temp_c: 55.0,
      thermal_resistance_k_per_w: 0.12,
      thermal_capacitance_j_per_k: 250.0,
    },
    {
      gpu_id: 'GPU-2',
      power_w: 350.0,
      heat_conversion_fraction: 0.95,
      initial_temp_c: 55.0,
      thermal_resistance_k_per_w: 0.12,
      thermal_capacitance_j_per_k: 250.0,
    },
  ]);

  const [enableAgmd, setEnableAgmd] = useState<boolean>(true);
  const [durationS, setDurationS] = useState<number>(60.0);
  const [timeStepS, setTimeStepS] = useState<number>(1.0);
  const [simulationResult, setSimulationResult] = useState<MultiGPUSimulationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/multi-gpu/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gpus,
          simulation_duration_s: durationS,
          time_step_s: timeStepS,
          primary_initial_temp_c: 50.0,
          secondary_initial_temp_c: 45.0,
          agmd_cold_plate_temp_c: 20.0,
          enable_agmd: enableAgmd,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Simulation request failed' }));
        throw new Error(errData.detail || `Server returned code ${res.status}`);
      }

      const data: MultiGPUSimulationResponse = await res.json();
      setSimulationResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to execute simulation');
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = async () => {
    setLoading(true);
    try {
      await fetch('/api/multi-gpu/reset', { method: 'POST' });
      await runSimulation();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run initial simulation on component mount
  useEffect(() => {
    runSimulation();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">CondensAI</h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800 rounded">
                  v1.5.0 (Module 6)
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Turning AI's Wasted Heat into Clean Water — Multi-GPU Thermal &amp; AGMD Digital Twin
              </p>
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('3d')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === '3d'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>3D Digital Twin</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics &amp; Charts</span>
            </button>
          </div>

          {/* Online Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Physics Engine Online</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {error && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 text-xs text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: 3D Digital Twin View */}
        {activeTab === '3d' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Multi-GPU Quick Controls */}
            <MultiGPUControlPanel
              gpus={gpus}
              setGpus={setGpus}
              enableAgmd={enableAgmd}
              setEnableAgmd={setEnableAgmd}
              durationS={durationS}
              setDurationS={setDurationS}
              timeStepS={timeStepS}
              setTimeStepS={setTimeStepS}
              onSimulate={runSimulation}
              onReset={resetSimulation}
              loading={loading}
            />

            {/* Interactive 3D Digital Twin Canvas */}
            <DigitalTwinPage
              simulationResult={simulationResult}
              gpuConfigs={gpus}
              onRunSimulation={runSimulation}
              isLoading={loading}
            />
          </div>
        )}

        {/* Tab 2: Analytics & Charts Dashboard */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Multi-GPU Control Panel */}
            <MultiGPUControlPanel
              gpus={gpus}
              setGpus={setGpus}
              enableAgmd={enableAgmd}
              setEnableAgmd={setEnableAgmd}
              durationS={durationS}
              setDurationS={setDurationS}
              timeStepS={timeStepS}
              setTimeStepS={setTimeStepS}
              onSimulate={runSimulation}
              onReset={resetSimulation}
              loading={loading}
            />

            {/* Water Production Overview */}
            <WaterProductionOverview
              analytics={simulationResult?.analytics}
              totalFreshwaterL={simulationResult?.total_freshwater_produced_l}
            />

            {/* Thermal Efficiency Dashboard */}
            <ThermalEfficiencyDashboard
              analytics={simulationResult?.analytics}
              totalGpuHeatJ={simulationResult?.total_heat_generated_j}
              totalHxHeatJ={simulationResult?.total_heat_recovered_hx_j}
              totalAgmdHeatJ={simulationResult?.total_heat_to_agmd_j}
            />

            {/* GPU Comparison View */}
            {simulationResult && (
              <GPUComparisonView
                gpuComparison={simulationResult.gpu_comparison}
                aggregatePowerW={simulationResult.aggregate_power_w}
              />
            )}

            {/* Dynamic Time-Series Charts */}
            {simulationResult && <TimeSeriesCharts timeSeries={simulationResult.time_series} />}

            {/* Scaling Comparison View (1 vs 2 vs 4 GPUs) */}
            <ScalingComparisonView />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 text-slate-500 text-xs py-6 px-6 text-center">
        <p>CondensAI Physics Digital Twin • Modules 1–6 Fully Integrated • Interactive 3D Real-Time Twin &amp; Analytics</p>
      </footer>
    </div>
  );
};

export default App;
