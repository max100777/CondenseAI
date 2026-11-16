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
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Thermal Performance & Efficiency</h2>
            <p className="text-xs text-slate-400">
              First-Law Thermodynamic Waste-Heat Recovery and AGMD Conversion Metrics
            </p>
          </div>
        </div>
        <div className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Residual: {Math.abs(energyResidual) < 1e-5 ? '< 10⁻⁵ J' : `${energyResidual.toExponential(2)} J`}</span>
        </div>
      </div>

      <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 mb-5 text-xs text-amber-200/90">
        <strong>Thermodynamic Note:</strong> Thermal recovery and utilization ratios quantify thermal enthalpy transfer
        across heat exchangers and membrane distillation, distinct from GPU electrical efficiency.
      </div>

      {/* Energy Flow Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>1. GPU Waste Heat Generated</span>
          </div>
          <div className="text-xl font-bold text-slate-100 mt-2">
            {(gpuHeatJ / 1e3).toFixed(2)} <span className="text-xs text-slate-400 font-normal">kJ</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Primary dissipation source</div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ArrowRight className="w-4 h-4 text-cyan-400" />
            <span>2. Heat Recovered by Exchanger</span>
          </div>
          <div className="text-xl font-bold text-cyan-300 mt-2">
            {(hxHeatJ / 1e3).toFixed(2)} <span className="text-xs text-slate-400 font-normal">kJ</span>
          </div>
          <div className="text-[11px] text-cyan-500/80 mt-0.5">
            Recovery: {etaHx !== null && etaHx !== undefined ? `${etaHx.toFixed(1)}% of GPU heat` : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>3. Heat Consumed by AGMD</span>
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-2">
            {(agmdHeatJ / 1e3).toFixed(2)} <span className="text-xs text-slate-400 font-normal">kJ</span>
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-0.5">
            Utilization: {etaUtil !== null && etaUtil !== undefined ? `${etaUtil.toFixed(1)}% of recovered` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Efficiency Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Heat Exchanger Recovery Efficiency */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 font-medium">HX Recovery Ratio (η<sub className="text-[9px]">HX</sub>)</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            {etaHx !== null && etaHx !== undefined ? `${etaHx.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_HX / E_GPU,gen</div>
        </div>

        {/* Heat Utilization Efficiency */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 font-medium">Heat Utilization (η<sub className="text-[9px]">util</sub>)</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {etaUtil !== null && etaUtil !== undefined ? `${etaUtil.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_AGMD / E_HX</div>
        </div>

        {/* GPU-to-AGMD Overall Conversion */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3.5">
          <div className="text-xs text-slate-400 font-medium">Conversion (η<sub className="text-[9px]">GPU→AGMD</sub>)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {etaGpuAgmd !== null && etaGpuAgmd !== undefined ? `${etaGpuAgmd.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">E_AGMD / E_GPU,gen</div>
        </div>

        {/* Specific Thermal Energy Consumption */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3.5">
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
    </div>
  );
};
