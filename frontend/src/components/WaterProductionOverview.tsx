import React from 'react';
import { Droplet, Gauge, Flame, Percent } from 'lucide-react';
import { AnalyticsSummary } from '../types';

interface Props {
  analytics?: AnalyticsSummary | null;
  totalFreshwaterL?: number | null;
}

export const WaterProductionOverview: React.FC<Props> = ({ analytics, totalFreshwaterL }) => {
  const totalL = analytics?.total_freshwater_volume_l ?? totalFreshwaterL ?? 0.0;
  const totalML = analytics?.total_freshwater_volume_ml ?? totalL * 1000.0;
  const currentRate = analytics?.instantaneous_production_l_h ?? 0.0;
  const avgRate = analytics?.average_production_l_h ?? 0.0;
  const avgFlux = analytics?.average_flux_lmh ?? 0.0;
  const maxFlux = analytics?.maximum_flux_lmh ?? 0.0;
  const agmdEnergyKwh = analytics?.total_agmd_energy_kwh ?? 0.0;
  const agmdEnergyJ = analytics?.total_agmd_energy_j ?? 0.0;
  const recoveryPct = analytics?.water_recovery_percent;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Water Production Overview</h2>
            <p className="text-xs text-slate-400">Air-Gap Membrane Distillation (AGMD) Yield & Permeate Performance</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
          Module 5 Analytics
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Freshwater */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-medium">Total Freshwater Produced</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">
            {totalL >= 0.001 ? `${totalL.toFixed(4)} L` : `${totalML.toFixed(2)} mL`}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalML.toFixed(2)} mL pure distillate
          </div>
        </div>

        {/* Production Rates */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-medium">Production Rate (L/h)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {currentRate.toFixed(4)} <span className="text-sm font-normal text-slate-400">L/h</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Avg: {avgRate.toFixed(4)} L/h
          </div>
        </div>

        {/* Membrane Flux */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Membrane Flux</span>
            <Gauge className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-teal-300 mt-1">
            {avgFlux.toFixed(2)} <span className="text-sm font-normal text-slate-400">LMH</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Peak: {maxFlux.toFixed(2)} LMH (time-weighted)
          </div>
        </div>

        {/* AGMD Energy & Recovery */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Thermal Energy & Recovery</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1">
            {agmdEnergyKwh.toFixed(4)} <span className="text-sm font-normal text-slate-400">kWh<sub className="text-[10px]">th</sub></span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>{(agmdEnergyJ / 1e3).toFixed(1)} kJ</span>
            {recoveryPct !== null && recoveryPct !== undefined && (
              <span className="text-cyan-400 font-medium flex items-center gap-0.5">
                <Percent className="w-2.5 h-2.5" /> {recoveryPct.toFixed(3)}% rec
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
