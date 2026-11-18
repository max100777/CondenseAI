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
    <section className="panel">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-50 p-2 text-cyan-800">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="panel-heading">Water production</h2>
            <p className="panel-subtitle">AGMD distillate yield and membrane performance indicators.</p>
          </div>
        </div>
        <span className="status-badge border-cyan-200 bg-cyan-50 text-cyan-800">
          Analytics output
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Freshwater */}
        <div className="metric-card">
          <div className="field-label">Total freshwater produced</div>
          <div className="mt-1 text-2xl font-bold text-cyan-800">
            {totalL >= 1.0
              ? `${totalL.toFixed(3)} L`
              : totalL >= 0.001
              ? `${totalML.toFixed(2)} mL`
              : `${(totalL * 1e6).toFixed(1)} µL`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {totalL >= 0.001 ? `${totalML.toFixed(2)} mL pure distillate` : `${(totalL * 1e6).toFixed(1)} µL (${totalML.toFixed(3)} mL)`}
          </div>
        </div>

        {/* Production Rates */}
        <div className="metric-card">
          <div className="field-label">Production rate</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">
            {currentRate.toFixed(4)} <span className="text-sm font-normal text-slate-500">L/h</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Avg: {avgRate.toFixed(4)} L/h
          </div>
        </div>

        {/* Membrane Flux */}
        <div className="metric-card">
          <div className="field-label flex items-center justify-between">
            <span>Membrane Flux</span>
            <Gauge className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-1 text-2xl font-bold text-teal-700">
            {avgFlux.toFixed(2)} <span className="text-sm font-normal text-slate-500">LMH</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Peak: {maxFlux.toFixed(2)} LMH (time-weighted)
          </div>
        </div>

        {/* AGMD Energy & Recovery */}
        <div className="metric-card">
          <div className="field-label flex items-center justify-between">
            <span>Thermal Energy & Recovery</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-700">
            {agmdEnergyKwh.toFixed(4)} <span className="text-sm font-normal text-slate-500">kWh<sub className="text-[10px]">th</sub></span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{(agmdEnergyJ / 1e3).toFixed(1)} kJ</span>
            {recoveryPct !== null && recoveryPct !== undefined && (
              <span className="flex items-center gap-0.5 font-medium text-cyan-800">
                <Percent className="w-2.5 h-2.5" /> {recoveryPct.toFixed(3)}% rec
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
