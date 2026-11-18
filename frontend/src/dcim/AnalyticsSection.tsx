import { useState } from 'react';
import {
  Activity,
  Cpu,
  Zap,
  Droplets,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';
import type { TelemetrySnapshot } from './simulation/simulationController.ts';

interface AnalyticsSectionProps {
  simulationState: IntegratedEngineeringState;
  telemetryHistory: TelemetrySnapshot[];
  onFocusHallIn3D?: (hallId: string) => void;
}

type AnalyticsCategory =
  | 'overview'
  | 'power'
  | 'thermal'
  | 'cooling'
  | 'heatRecovery'
  | 'water'
  | 'reliability';

export default function AnalyticsSection({
  simulationState,
  telemetryHistory,
}: AnalyticsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategory>('overview');
  const { hydraulics, electrical, heatRecovery, agmd, gpus } = simulationState;

  const gpuList = Object.values(gpus);
  const sampleCount = telemetryHistory.length;

  // Compute thermal distribution histogram buckets: [<45°C, 45-55°C, 55-65°C, 65-75°C, >75°C]
  const tempBuckets = [
    { range: '< 45°C', count: gpuList.filter((g) => g.temperatureC < 45).length, color: '#38bdf8' },
    { range: '45–55°C', count: gpuList.filter((g) => g.temperatureC >= 45 && g.temperatureC < 55).length, color: '#34d399' },
    { range: '55–65°C', count: gpuList.filter((g) => g.temperatureC >= 55 && g.temperatureC < 65).length, color: '#22c55e' },
    { range: '65–75°C', count: gpuList.filter((g) => g.temperatureC >= 65 && g.temperatureC < 75).length, color: '#f59e0b' },
    { range: '≥ 75°C', count: gpuList.filter((g) => g.temperatureC >= 75).length, color: '#ef4444' },
  ];

  return (
    <div className="dc-analytics-full-view">
      {/* 1. CATEGORY NAVIGATION TABS */}
      <div className="dc-analytics-sidebar">
        <small>ANALYTICS DOMAINS</small>
        <button
          className={activeCategory === 'overview' ? 'active' : ''}
          onClick={() => setActiveCategory('overview')}
        >
          <Activity size={14} /> Overview & Trajectory
        </button>
        <button
          className={activeCategory === 'power' ? 'active' : ''}
          onClick={() => setActiveCategory('power')}
        >
          <Zap size={14} /> Electrical & Power Demand
        </button>
        <button
          className={activeCategory === 'thermal' ? 'active' : ''}
          onClick={() => setActiveCategory('thermal')}
        >
          <Cpu size={14} /> Thermal & Silicon Health
        </button>
        <button
          className={activeCategory === 'cooling' ? 'active' : ''}
          onClick={() => setActiveCategory('cooling')}
        >
          <Droplets size={14} /> Coolant Hydraulics & CDU
        </button>
        <button
          className={activeCategory === 'heatRecovery' ? 'active' : ''}
          onClick={() => setActiveCategory('heatRecovery')}
        >
          <Flame size={14} /> Heat Recovery & Buffer
        </button>
        <button
          className={activeCategory === 'water' ? 'active' : ''}
          onClick={() => setActiveCategory('water')}
        >
          <Droplets size={14} /> AGMD Water Desalination
        </button>
        <button
          className={activeCategory === 'reliability' ? 'active' : ''}
          onClick={() => setActiveCategory('reliability')}
        >
          <ShieldAlert size={14} /> Reliability & Fault Trends
        </button>
      </div>

      {/* 2. MAIN CHARTS CONTENT AREA */}
      <div className="dc-analytics-body">
        {/* DOMAIN 1: OVERVIEW & TRAJECTORY */}
        {activeCategory === 'overview' && (
          <div className="dc-chart-domain">
            <div className="dc-chart-domain-head">
              <h2>Overview & Facility Time-Series Trajectory</h2>
              <p>Synchronized temporal trace of facility electrical power, IT demand, and freshwater recovery ({sampleCount} samples recorded).</p>
            </div>

            <div className="dc-charts-grid">
              {/* Chart 1: Power & IT Demand Trajectory */}
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>Facility Power vs IT Load (kW)</strong>
                  <span className="dc-box-tag">Time Series (s)</span>
                </div>
                <div className="dc-svg-chart-container">
                  <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <line x1="0" y1="140" x2="600" y2="140" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="80" x2="600" y2="80" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="20" x2="600" y2="20" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                    {/* Facility Power Line (Yellow) */}
                    <polyline
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - ((t.facilityTotalPowerKw - 60) / 100) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                    {/* IT Load Line (Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - ((t.totalITPowerKw - 60) / 100) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                  <div className="dc-chart-legend">
                    <span style={{ color: '#eab308' }}>— Total Facility Power ({electrical.facilityTotalPowerKw.toFixed(1)} kW)</span>
                    <span style={{ color: '#38bdf8' }}>— IT Server Power ({electrical.facilityITPowerKw.toFixed(1)} kW)</span>
                  </div>
                </div>
              </div>

              {/* Chart 2: Distillate Freshwater Output Trajectory */}
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>AGMD Distillate Rate & Cumulative Water (L)</strong>
                  <span className="dc-box-tag">Desalination</span>
                </div>
                <div className="dc-svg-chart-container">
                  <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <line x1="0" y1="140" x2="600" y2="140" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="0" y1="80" x2="600" y2="80" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                    {/* Freshwater Rate Line (Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - (t.freshwaterRateL_H / 120) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                    {/* Cumulative Volume Area / Line (Emerald) */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - (t.cumulativeFreshwaterL / Math.max(1, agmd.cumulativeFreshwaterL * 1.2)) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                  <div className="dc-chart-legend">
                    <span style={{ color: '#06b6d4' }}>— Permeate Rate ({agmd.freshwaterProductionRateL_H.toFixed(1)} L/h)</span>
                    <span style={{ color: '#10b981' }}>— Cumulative Water ({agmd.cumulativeFreshwaterL.toFixed(2)} Liters)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 2: THERMAL & SILICON HEALTH */}
        {activeCategory === 'thermal' && (
          <div className="dc-chart-domain">
            <div className="dc-chart-domain-head">
              <h2>Thermal Dynamics & Silicon Junction Distribution</h2>
              <p>Silicon die junction histogram, cold plate convection, and transient temperature response.</p>
            </div>

            <div className="dc-charts-grid">
              {/* Histogram Card */}
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>144 GPU Junction Temperature Histogram</strong>
                  <span className="dc-box-tag">Population Distribution</span>
                </div>
                <div className="dc-histogram-container">
                  {tempBuckets.map((b) => (
                    <div key={b.range} className="dc-hist-col">
                      <span className="dc-hist-count">{b.count}</span>
                      <div className="dc-hist-bar-track">
                        <div
                          className="dc-hist-bar"
                          style={{
                            height: `${(b.count / 144) * 100}%`,
                            backgroundColor: b.color,
                          }}
                        />
                      </div>
                      <span className="dc-hist-label">{b.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary Loop Coolant Delta T Trace */}
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>Primary Supply vs Return Temperature (°C)</strong>
                  <span className="dc-box-tag">CDU Hydronics</span>
                </div>
                <div className="dc-svg-chart-container">
                  <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - ((t.primaryReturnTempC - 20) / 30) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - ((t.primarySupplyTempC - 20) / 30) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                  <div className="dc-chart-legend">
                    <span style={{ color: '#f97316' }}>— Mixed Return ({hydraulics.primaryReturnTempC.toFixed(1)}°C)</span>
                    <span style={{ color: '#06b6d4' }}>— CDU Supply ({hydraulics.primarySupplyTempC.toFixed(1)}°C)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 3: HEAT RECOVERY & SECONDARY BUFFER */}
        {activeCategory === 'heatRecovery' && (
          <div className="dc-chart-domain">
            <div className="dc-chart-domain-head">
              <h2>Heat Recovery Thermodynamics & 15,000 L Storage</h2>
              <p>First-Law Energy balance across counterflow plate heat exchanger and secondary storage flywheel.</p>
            </div>

            <div className="dc-charts-grid">
              {/* Heat Exchanger Heat Transfer Trajectory */}
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>Recovered Heat Transfer Rate (kWth)</strong>
                  <span className="dc-box-tag">Plate & Frame</span>
                </div>
                <div className="dc-svg-chart-container">
                  <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - (t.hxHeatTransferKw / 100) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                  <div className="dc-chart-legend">
                    <span style={{ color: '#10b981' }}>— Heat Transferred ({heatRecovery.heatTransferredKw.toFixed(1)} kWth)</span>
                    <span style={{ color: '#94a3b8' }}>• Energy Balance Residual: {heatRecovery.energyBalanceResidualPercent.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* Thermal Buffer Tank Temperature Trajectory */}
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>15,000 L Thermal Buffer Temperature (°C)</strong>
                  <span className="dc-box-tag">Transient Dynamic</span>
                </div>
                <div className="dc-svg-chart-container">
                  <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      points={telemetryHistory
                        .map((t, idx) => {
                          const x = (600 * idx) / Math.max(1, telemetryHistory.length - 1);
                          const y = 140 - ((t.bufferTankTempC - 20) / 30) * 120;
                          return `${x},${Math.max(10, Math.min(145, y))}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                  <div className="dc-chart-legend">
                    <span style={{ color: '#38bdf8' }}>— Buffer Temp ({heatRecovery.bufferTankTempC.toFixed(2)}°C)</span>
                    <span style={{ color: '#94a3b8' }}>• Dynamic dT/dt: +0.68°C/h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 4: ELECTRICAL, COOLING, WATER, RELIABILITY FALLBACK PANELS */}
        {(activeCategory === 'power' || activeCategory === 'cooling' || activeCategory === 'water' || activeCategory === 'reliability') && (
          <div className="dc-chart-domain">
            <div className="dc-chart-domain-head">
              <h2>{activeCategory.toUpperCase()} Detailed Engineering Telemetry</h2>
              <p>Active subsystem telemetry streams and operational threshold monitoring.</p>
            </div>
            <div className="dc-charts-grid">
              <div className="dc-chart-box">
                <div className="dc-box-head">
                  <strong>Live Subsystem Summary</strong>
                  <span className="dc-box-tag">Real-Time</span>
                </div>
                <div className="dc-summary-details">
                  <p>Facility Total Electrical Power: <strong>{electrical.facilityTotalPowerKw.toFixed(1)} kW</strong></p>
                  <p>Facility IT Power Load: <strong>{electrical.facilityITPowerKw.toFixed(1)} kW</strong></p>
                  <p>Instantaneous PUE: <strong>{electrical.instantaneousPUE.toFixed(2)}</strong></p>
                  <p>Primary Coolant Mass Flow: <strong>{hydraulics.totalSystemFlowKgS.toFixed(3)} kg/s</strong></p>
                  <p>Plate Heat Exchanger Transfer: <strong>{heatRecovery.heatTransferredKw.toFixed(1)} kWth</strong></p>
                  <p>AGMD Freshwater Production Rate: <strong>{agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</strong></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
