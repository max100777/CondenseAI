import React, { useState, useEffect } from 'react';
import { Droplets, Box, BarChart3, CircleCheck } from 'lucide-react';
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
    <div className="app-shell flex flex-col selection:bg-cyan-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 py-3 shadow-sm backdrop-blur">
        <div className="content-width flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-800 shadow-sm">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">CondensAI</h1>
                <span className="rounded border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                  Engineering Digital Twin
                </span>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Waste-heat recovery and AGMD desalination simulation environment
              </p>
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('3d')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === '3d'
                  ? 'bg-white text-cyan-800 shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-800'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>3D Digital Twin</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-cyan-800 shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics &amp; Charts</span>
            </button>
          </div>

          {/* Online Indicator */}
          <div className="hidden items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs lg:flex">
            <CircleCheck className="h-3.5 w-3.5 text-emerald-700" />
            <span className="font-medium text-slate-700">{loading ? 'Computing simulation' : error ? 'Request failed' : simulationResult ? 'Simulation complete' : 'Awaiting simulation'}</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="content-width flex-1 space-y-6 py-6">
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-semibold text-rose-800 hover:text-rose-950">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: 3D Digital Twin View */}
        {activeTab === '3d' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Multi-GPU Quick Controls */}
            <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700">Simulation configuration <span className="ml-2 font-normal text-slate-500">{gpus.length} GPUs · {durationS} s</span></summary>
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

            </details>
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
      <footer className="mt-6 border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <p>CondensAI • Physics-based GPU waste-heat recovery and AGMD desalination model • Academic demonstration interface</p>
      </footer>
    </div>
  );
};

export default App;
