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

  const runScalingBenchmark = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Multi-GPU Scaling Comparison</h2>
            <p className="text-xs text-slate-400">1 GPU vs 2 GPUs vs 4 GPUs Physics Benchmark (60s Baseline)</p>
          </div>
        </div>

        <button
          onClick={runScalingBenchmark}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium text-xs transition flex items-center gap-2 ${
            loading
              ? 'bg-purple-800 text-slate-300 cursor-wait'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {loading ? 'Running Multi-Tier Benchmark...' : 'Run 1 vs 2 vs 4 GPU Benchmark'}
        </button>
      </div>

      <div className="bg-purple-950/20 border border-purple-900/30 rounded-lg p-3 mb-5 text-xs text-purple-200/90 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Non-Linear Thermodynamics:</strong> While electrical power scales linearly (350W → 700W → 1400W),
          vapor pressure and freshwater production scale exponentially via the Antoine equation as reservoir
          temperatures elevate, governed by membrane conduction and cold plate heat rejection.
        </div>
      </div>

      {data ? (
        <div className="space-y-6">
          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
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
              <tbody className="divide-y divide-slate-800/60">
                {data.map((row) => (
                  <tr key={row.gpus} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-semibold text-purple-300">{row.label}</td>
                    <td className="py-2.5 px-3 text-right text-slate-100">{row.aggregatePowerW} W</td>
                    <td className="py-2.5 px-3 text-right text-rose-300">{row.heatGeneratedKJ.toFixed(1)} kJ</td>
                    <td className="py-2.5 px-3 text-right text-cyan-300">{row.heatRecoveredKJ.toFixed(1)} kJ</td>
                    <td className="py-2.5 px-3 text-right text-amber-300 font-medium">
                      {row.finalReservoirTempC.toFixed(2)} °C
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">{row.agmdEnergyKJ.toFixed(2)} kJ</td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-bold">
                      {(row.freshwaterYieldL * 1000).toFixed(2)} mL
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
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
        <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <TrendingUp className="w-6 h-6 text-slate-600" />
          <span>Click "Run 1 vs 2 vs 4 GPU Benchmark" to compute live comparative physics scaling curves.</span>
        </div>
      )}
    </div>
  );
};
