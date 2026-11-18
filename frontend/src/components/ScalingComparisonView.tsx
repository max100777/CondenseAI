import React, { useState } from 'react';
import { BarChart3, TrendingUp, AlertCircle, Play } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface BenchmarkTier {
  gpus: number;
  label: string;
  aggregatePowerW: number;
  heatGeneratedKJ: number;
  heatRecoveredKJ: number;
  finalReservoirTempC: number;
  agmdEnergyKJ: number;
  freshwaterYieldL: number;
  heatUtilizationPct: number;
}

export const ScalingComparisonView: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<BenchmarkTier[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScalingBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const runConfig = async (n: number) => {
        const gpus = Array.from({ length: n }, (_, i) => ({
          gpu_id: `GPU-${i + 1}`,
          power_w: 350.0,
          heat_conversion_fraction: 0.95,
          initial_temp_c: 55.0,
          thermal_resistance_k_per_w: 0.12,
          thermal_capacitance_j_per_k: 250.0,
        }));

        const res = await fetch('/api/multi-gpu/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gpus,
            simulation_duration_s: 60.0,
            time_step_s: 1.0,
            primary_initial_temp_c: 50.0,
            secondary_initial_temp_c: 45.0,
            agmd_cold_plate_temp_c: 20.0,
            enable_agmd: true,
          }),
        });
        if (!res.ok) throw new Error('Failed to run benchmark');
        return await res.json();
      };

      const [res1, res2, res4] = await Promise.all([runConfig(1), runConfig(2), runConfig(4)]);

      const tiers: BenchmarkTier[] = [
        {
          gpus: 1,
          label: '1 GPU (350 W)',
          aggregatePowerW: res1.aggregate_power_w,
          heatGeneratedKJ: res1.total_heat_generated_j / 1000.0,
          heatRecoveredKJ: res1.total_heat_recovered_hx_j / 1000.0,
          finalReservoirTempC: res1.final_secondary_reservoir_temp_c,
          agmdEnergyKJ: res1.total_heat_to_agmd_j / 1000.0,
          freshwaterYieldL: res1.total_freshwater_produced_l ?? 0.0,
          heatUtilizationPct: res1.analytics?.heat_utilization_percent ?? 0.0,
        },
        {
          gpus: 2,
          label: '2 GPUs (700 W)',
          aggregatePowerW: res2.aggregate_power_w,
          heatGeneratedKJ: res2.total_heat_generated_j / 1000.0,
          heatRecoveredKJ: res2.total_heat_recovered_hx_j / 1000.0,
          finalReservoirTempC: res2.final_secondary_reservoir_temp_c,
          agmdEnergyKJ: res2.total_heat_to_agmd_j / 1000.0,
          freshwaterYieldL: res2.total_freshwater_produced_l ?? 0.0,
          heatUtilizationPct: res2.analytics?.heat_utilization_percent ?? 0.0,
        },
        {
          gpus: 4,
          label: '4 GPUs (1400 W)',
          aggregatePowerW: res4.aggregate_power_w,
          heatGeneratedKJ: res4.total_heat_generated_j / 1000.0,
          heatRecoveredKJ: res4.total_heat_recovered_hx_j / 1000.0,
          finalReservoirTempC: res4.final_secondary_reservoir_temp_c,
          agmdEnergyKJ: res4.total_heat_to_agmd_j / 1000.0,
          freshwaterYieldL: res4.total_freshwater_produced_l ?? 0.0,
          heatUtilizationPct: res4.analytics?.heat_utilization_percent ?? 0.0,
        },
      ];

      setData(tiers);
    } catch (err) {
      console.error(err);
      setError('The benchmark could not be completed. Confirm that the simulation API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-50 p-2 text-cyan-800">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="panel-heading">Scaling benchmark</h2>
            <p className="panel-subtitle">Controlled 60-second comparison of one, two, and four GPU configurations.</p>
          </div>
        </div>

        <button
          onClick={runScalingBenchmark}
          disabled={loading}
          className="btn-primary"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {loading ? 'Running Multi-Tier Benchmark...' : 'Run 1 vs 2 vs 4 GPU Benchmark'}
        </button>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-800" />
        <div>
          <strong>Non-Linear Thermodynamics:</strong> While electrical power scales linearly (350W → 700W → 1400W),
          vapor pressure and freshwater production scale exponentially via the Antoine equation as reservoir
          temperatures elevate, governed by membrane conduction and cold plate heat rejection.
        </div>
      </div>

      {error && <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}

      {data ? (
        <div className="space-y-6">
          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2.5 px-3 font-medium">Cluster Scale</th>
                  <th className="py-2.5 px-3 font-medium text-right">Power</th>
                  <th className="py-2.5 px-3 font-medium text-right">Heat Gen. (kJ)</th>
                  <th className="py-2.5 px-3 font-medium text-right">HX Recovered (kJ)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Final Reservoir T</th>
                  <th className="py-2.5 px-3 font-medium text-right">AGMD Energy (kJ)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Freshwater Yield</th>
                  <th className="py-2.5 px-3 font-medium text-right">Heat Utilization</th>
                </tr>
              </thead>
          <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.gpus} className="transition hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-cyan-800">{row.label}</td>
                    <td className="py-2.5 px-3 text-right text-slate-800">{row.aggregatePowerW} W</td>
                    <td className="py-2.5 px-3 text-right text-rose-700">{row.heatGeneratedKJ.toFixed(1)} kJ</td>
                    <td className="py-2.5 px-3 text-right text-cyan-800">{row.heatRecoveredKJ.toFixed(1)} kJ</td>
                    <td className="py-2.5 px-3 text-right font-medium text-amber-700">
                      {row.finalReservoirTempC.toFixed(2)} °C
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700">{row.agmdEnergyKJ.toFixed(2)} kJ</td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-800">
                      {(row.freshwaterYieldL * 1000).toFixed(2)} mL
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">
                      {row.heatUtilizationPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Side-by-side Visual Bars */}
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis yAxisId="left" stroke="#38bdf8" label={{ value: 'Heat Recovered (kJ)', angle: -90, position: 'insideLeft', fill: '#38bdf8' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" label={{ value: 'Freshwater (mL)', angle: 90, position: 'insideRight', fill: '#10b981' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" dataKey="heatRecoveredKJ" name="HX Heat Recovered (kJ)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey={(d) => (d.freshwaterYieldL * 1000).toFixed(2)} name="Distillate Yield (mL)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
          <TrendingUp className="h-6 w-6 text-slate-400" />
          <span>Run the benchmark to calculate live comparative scaling data.</span>
        </div>
      )}
    </section>
  );
};
