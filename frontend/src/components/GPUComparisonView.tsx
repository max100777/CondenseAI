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
    <section className="panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-50 p-2 text-cyan-800">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="panel-heading">GPU cluster summary</h2>
            <p className="panel-subtitle">Node-level thermal state and aggregate waste-heat dissipation.</p>
          </div>
        </div>
        <div className="status-badge border-slate-200 bg-slate-50 text-slate-700">
          {gpuComparison.length} Nodes Online
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th className="py-2.5 px-3 font-medium">GPU Node</th>
              <th className="py-2.5 px-3 font-medium text-right">Electrical Power</th>
              <th className="py-2.5 px-3 font-medium text-right">Junction Temp</th>
              <th className="py-2.5 px-3 font-medium text-right">Heat Generated</th>
              <th className="py-2.5 px-3 font-medium text-right">Heat to Coolant</th>
              <th className="py-2.5 px-3 font-medium text-right">Stored Energy</th>
              <th className="py-2.5 px-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gpuComparison.map((g) => (
              <tr key={g.gpu_id} className="transition hover:bg-slate-50">
                <td className="py-2.5 px-3 font-semibold text-cyan-800">{g.gpu_id}</td>
                <td className="py-2.5 px-3 text-right text-slate-700">{g.power_w.toFixed(1)} W</td>
                <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                  {g.final_temp_c.toFixed(2)} °C
                </td>
                <td className="py-2.5 px-3 text-right text-slate-700">{g.heat_generated_w.toFixed(2)} W</td>
                <td className="py-2.5 px-3 text-right text-cyan-800">{g.heat_to_coolant_w.toFixed(2)} W</td>
                <td className="py-2.5 px-3 text-right text-slate-500">{(g.stored_energy_j / 1e3).toFixed(2)} kJ</td>
                <td className="py-2.5 px-3 text-center">
                  {g.status === 'warning' ? (
                      <span className="status-badge border-amber-200 bg-amber-50 text-amber-800">
                      <AlertTriangle className="w-3 h-3" /> Warning
                    </span>
                  ) : (
                      <span className="status-badge border-emerald-200 bg-emerald-50 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> Nominal
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
              <td className="py-3 px-3 text-cyan-800">Total cluster ({gpuComparison.length} GPUs)</td>
              <td className="py-3 px-3 text-right">{aggregatePowerW.toFixed(1)} W</td>
              <td className="py-3 px-3 text-right text-slate-400">—</td>
              <td className="py-3 px-3 text-right">{totalHeatGen.toFixed(2)} W</td>
              <td className="py-3 px-3 text-right text-cyan-800">{totalHeatCoolant.toFixed(2)} W</td>
              <td className="py-3 px-3 text-right text-slate-400">—</td>
              <td className="py-3 px-3 text-center text-emerald-700">Nominal</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};
