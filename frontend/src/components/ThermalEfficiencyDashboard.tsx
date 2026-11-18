import React from 'react';
import { Activity, Zap, ArrowRight, Gauge, Cpu, CheckCircle2 } from 'lucide-react';
import { AnalyticsSummary } from '../types';

interface Props {
  analytics?: AnalyticsSummary | null;
  totalGpuHeatJ?: number;
  totalHxHeatJ?: number;
  totalAgmdHeatJ?: number;
}

export const ThermalEfficiencyDashboard: React.FC<Props> = ({
  analytics,
  totalGpuHeatJ = 0,
  totalHxHeatJ = 0,
  totalAgmdHeatJ = 0,
}) => {
  const gpuHeatJ = analytics?.total_gpu_heat_generated_j ?? totalGpuHeatJ;
  const hxHeatJ = analytics?.total_heat_recovered_j ?? totalHxHeatJ;
  const agmdHeatJ = analytics?.total_agmd_energy_j ?? totalAgmdHeatJ;

  const etaHx = analytics?.heat_exchanger_recovery_percent;
  const etaUtil = analytics?.heat_utilization_percent;
  const etaGpuAgmd = analytics?.gpu_to_agmd_efficiency_percent;
  const stec = analytics?.specific_thermal_energy_kwh_m3;
  const energyResidual = analytics?.energy_balance_residual_j ?? 0.0;

  return (
    <section className="panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="panel-heading">Thermal performance</h2>
            <p className="panel-subtitle">
              First-law energy recovery, thermal utilization, and AGMD conversion metrics.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
          <CheckCircle2 className="h-3 w-3 text-emerald-700" />
          <span>Residual: {Math.abs(energyResidual) < 1e-5 ? '< 10⁻⁵ J' : `${energyResidual.toExponential(2)} J`}</span>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <strong>Thermodynamic Note:</strong> Thermal recovery and utilization ratios quantify thermal enthalpy transfer
        across heat exchangers and membrane distillation, distinct from GPU electrical efficiency.
      </div>

      {/* Energy Flow Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="metric-card relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Cpu className="h-4 w-4 text-cyan-800" />
            <span>1. GPU Waste Heat Generated</span>
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {(gpuHeatJ / 1e3).toFixed(2)} <span className="text-xs font-normal text-slate-500">kJ</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Primary dissipation source</div>
        </div>

        <div className="metric-card relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ArrowRight className="h-4 w-4 text-cyan-800" />
            <span>2. Heat Recovered by Exchanger</span>
          </div>
          <div className="mt-2 text-xl font-bold text-cyan-800">
            {(hxHeatJ / 1e3).toFixed(2)} <span className="text-xs font-normal text-slate-500">kJ</span>
          </div>
          <div className="text-[11px] text-cyan-500/80 mt-0.5">
            Recovery: {etaHx !== null && etaHx !== undefined ? `${etaHx.toFixed(1)}% of GPU heat` : 'N/A'}
          </div>
        </div>

        <div className="metric-card relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Zap className="h-4 w-4 text-emerald-700" />
            <span>3. Heat Consumed by AGMD</span>
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {(agmdHeatJ / 1e3).toFixed(2)} <span className="text-xs font-normal text-slate-500">kJ</span>
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-0.5">
            Utilization: {etaUtil !== null && etaUtil !== undefined ? `${etaUtil.toFixed(1)}% of recovered` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Efficiency Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Heat Exchanger Recovery Efficiency */}
        <div className="metric-card">
          <div className="text-xs text-slate-400 font-medium">HX Recovery Ratio (η<sub className="text-[9px]">HX</sub>)</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            {etaHx !== null && etaHx !== undefined ? `${etaHx.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_HX / E_GPU,gen</div>
        </div>

        {/* Heat Utilization Efficiency */}
        <div className="metric-card">
          <div className="text-xs text-slate-400 font-medium">Heat Utilization (η<sub className="text-[9px]">util</sub>)</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {etaUtil !== null && etaUtil !== undefined ? `${etaUtil.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_AGMD / E_HX</div>
        </div>

        {/* GPU-to-AGMD Overall Conversion */}
        <div className="metric-card">
          <div className="text-xs text-slate-400 font-medium">Conversion (η<sub className="text-[9px]">GPU→AGMD</sub>)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {etaGpuAgmd !== null && etaGpuAgmd !== undefined ? `${etaGpuAgmd.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_AGMD / E_GPU,gen</div>
        </div>

        {/* Specific Thermal Energy Consumption */}
        <div className="metric-card">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>STEC (Specific Energy)</span>
            <Gauge className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-1">
            {stec !== null && stec !== undefined ? (
              <>
                {stec.toFixed(1)} <span className="text-xs font-normal text-slate-400">kWh<sub className="text-[9px]">th</sub>/m³</span>
              </>
            ) : (
              <span className="text-sm font-normal text-slate-500">Awaiting Distillate</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_AGMD / V_freshwater</div>
        </div>
      </div>
    </section>
  );
};
