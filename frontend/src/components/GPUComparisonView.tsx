import React from 'react';
import { Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GPUComparisonItem } from '../types';

interface Props {
  gpuComparison: GPUComparisonItem[];
  aggregatePowerW: number;
}

export const GPUComparisonView: React.FC<Props> = ({ gpuComparison, aggregatePowerW }) => {
  if (!gpuComparison || gpuComparison.length === 0) {
    return null;
  }

  const totalHeatGen = gpuComparison.reduce((acc, g) => acc + g.heat_generated_w, 0);
  const totalHeatCoolant = gpuComparison.reduce((acc, g) => acc + g.heat_to_coolant_w, 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">GPU Cluster Comparison</h2>
            <p className="text-xs text-slate-400">Independent Thermodynamic Node States & Aggregate Thermal Dissipation</p>
          </div>
        </div>
        <div className="text-xs font-medium text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
          {gpuComparison.length} Nodes Online
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
              <th className="py-2.5 px-3 font-medium">GPU Node</th>
              <th className="py-2.5 px-3 font-medium text-right">Electrical Power</th>
              <th className="py-2.5 px-3 font-medium text-right">Junction Temp</th>
              <th className="py-2.5 px-3 font-medium text-right">Heat Generated</th>
              <th className="py-2.5 px-3 font-medium text-right">Heat to Coolant</th>
              <th className="py-2.5 px-3 font-medium text-right">Stored Energy</th>
              <th className="py-2.5 px-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {gpuComparison.map((g) => (
              <tr key={g.gpu_id} className="hover:bg-slate-800/30 transition">
                <td className="py-2.5 px-3 font-semibold text-indigo-300">{g.gpu_id}</td>
                <td className="py-2.5 px-3 text-right text-slate-200">{g.power_w.toFixed(1)} W</td>
                <td className="py-2.5 px-3 text-right font-medium text-rose-300">
                  {g.final_temp_c.toFixed(2)} °C
                </td>
                <td className="py-2.5 px-3 text-right text-slate-300">{g.heat_generated_w.toFixed(2)} W</td>
                <td className="py-2.5 px-3 text-right text-cyan-300">{g.heat_to_coolant_w.toFixed(2)} W</td>
                <td className="py-2.5 px-3 text-right text-slate-400">{(g.stored_energy_j / 1e3).toFixed(2)} kJ</td>
                <td className="py-2.5 px-3 text-center">
                  {g.status === 'warning' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                      <AlertTriangle className="w-3 h-3" /> Warning
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                      <CheckCircle2 className="w-3 h-3" /> Nominal
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-700 bg-slate-950/80 font-semibold text-slate-100">
              <td className="py-3 px-3 text-indigo-400">Total Cluster ({gpuComparison.length} GPUs)</td>
              <td className="py-3 px-3 text-right text-slate-100">{aggregatePowerW.toFixed(1)} W</td>
              <td className="py-3 px-3 text-right text-slate-400">—</td>
              <td className="py-3 px-3 text-right text-slate-100">{totalHeatGen.toFixed(2)} W</td>
              <td className="py-3 px-3 text-right text-cyan-300">{totalHeatCoolant.toFixed(2)} W</td>
              <td className="py-3 px-3 text-right text-slate-400">—</td>
              <td className="py-3 px-3 text-center text-emerald-400">Online</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
