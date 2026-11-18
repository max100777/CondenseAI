import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { MultiGPUStep } from '../types';

interface Props {
  timeSeries: MultiGPUStep[];
}

export const TimeSeriesCharts: React.FC<Props> = ({ timeSeries }) => {
  const [activeTab, setActiveTab] = useState<'production' | 'thermal' | 'temperatures' | 'heat_flow'>('production');

  if (!timeSeries || timeSeries.length === 0) {
    return (
      <div className="panel text-center text-slate-500">
        No simulation data is available. Configure the cluster and run the simulation.
      </div>
    );
  }

  // Format chart data with individual GPU temperatures
  const chartData = timeSeries.map((s) => {
    const point: Record<string, any> = {
      time_s: s.time_s,
      fw_rate_l_h: s.freshwater_production_rate_l_h ?? 0.0,
      cum_fw_l: s.cumulative_freshwater_volume_l ?? 0.0,
      primary_temp_c: s.primary_coolant_temp_c,
      secondary_temp_c: s.secondary_reservoir_temp_c,
      heat_to_agmd_w: s.heat_to_agmd_w,
      q_gen_w: s.aggregate_heat_generated_w,
      q_hx_w: s.hx_heat_transfer_w,
      q_coolant_w: s.aggregate_heat_to_coolant_w,
    };

    s.gpu_states.forEach((g) => {
      point[`temp_${g.gpu_id}`] = g.current_temp_c;
      point[`q_cool_${g.gpu_id}`] = g.heat_to_coolant_w;
    });

    return point;
  });

  const gpuIds = timeSeries[0]?.gpu_states.map((g) => g.gpu_id) || [];
  const gpuColors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <section className="panel">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="panel-heading">Transient simulation results</h2>
          <p className="panel-subtitle">Time-resolved thermal, water-production, and heat-transfer traces.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
          <button
            onClick={() => setActiveTab('production')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'production'
                ? 'bg-cyan-800 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            Water Production
          </button>
          <button
            onClick={() => setActiveTab('temperatures')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'temperatures'
                ? 'bg-cyan-800 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            Temperatures (All GPUs & Loops)
          </button>
          <button
            onClick={() => setActiveTab('heat_flow')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'heat_flow'
                ? 'bg-cyan-800 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            Heat Transfer & Recovery
          </button>
          <button
            onClick={() => setActiveTab('thermal')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeTab === 'thermal'
                ? 'bg-cyan-800 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            AGMD Extraction Rate
          </button>
        </div>
      </div>

      <div className="h-[360px] w-full">
        {activeTab === 'production' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFwRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCumFw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time_s" unit="s" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#06b6d4" label={{ value: 'Rate (L/h)', angle: -90, position: 'insideLeft', fill: '#06b6d4' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" label={{ value: 'Cum. Yield (L)', angle: 90, position: 'insideRight', fill: '#10b981' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Legend verticalAlign="top" height={36} />
              <Area yAxisId="left" type="monotone" dataKey="fw_rate_l_h" name="Production Rate (L/h)" stroke="#06b6d4" fillOpacity={1} fill="url(#colorFwRate)" />
              <Line yAxisId="right" type="monotone" dataKey="cum_fw_l" name="Cumulative Freshwater (L)" stroke="#10b981" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'temperatures' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time_s" unit="s" stroke="#94a3b8" />
              <YAxis stroke="#f43f5e" unit="°C" domain={['dataMin - 2', 'dataMax + 2']} label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fill: '#f43f5e' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Legend verticalAlign="top" height={36} />

              {/* Individual GPU Temperatures */}
              {gpuIds.map((id, idx) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={`temp_${id}`}
                  name={`${id} Temp (°C)`}
                  stroke={gpuColors[idx % gpuColors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}

              {/* Loop Temperatures */}
              <Line type="monotone" dataKey="primary_temp_c" name="Primary Coolant (°C)" stroke="#38bdf8" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="secondary_temp_c" name="Secondary Reservoir (°C)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'heat_flow' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time_s" unit="s" stroke="#94a3b8" />
              <YAxis stroke="#e2e8f0" unit="W" label={{ value: 'Thermal Power (W)', angle: -90, position: 'insideLeft', fill: '#e2e8f0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="q_gen_w" name="Total GPU Heat Generated (W)" stroke="#f43f5e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="q_coolant_w" name="Heat to Coolant (W)" stroke="#818cf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="q_hx_w" name="Exchanger Recovery (W)" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'thermal' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAgmdPower" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time_s" unit="s" stroke="#94a3b8" />
              <YAxis stroke="#10b981" unit="W" label={{ value: 'AGMD Thermal Power (W)', angle: -90, position: 'insideLeft', fill: '#10b981' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey="heat_to_agmd_w" name="Actual AGMD Heat Extracted (W)" stroke="#10b981" fillOpacity={1} fill="url(#colorAgmdPower)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};
