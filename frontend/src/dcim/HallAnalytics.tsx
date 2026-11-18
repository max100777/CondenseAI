import { useState } from 'react';
import {
  BarChart3,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';

interface HallAnalyticsProps {
  simulationState: IntegratedEngineeringState;
  onFocusHallIn3D: (hallId: string) => void;
}

type ComparisonMetric = 'power' | 'utilization' | 'avgTemp' | 'peakTemp' | 'coolantFlow' | 'perfPerKw';

export default function HallAnalytics({
  simulationState,
  onFocusHallIn3D,
}: HallAnalyticsProps) {
  const { halls, racks, gpus } = simulationState;
  const [selectedMetric, setSelectedMetric] = useState<ComparisonMetric>('power');

  const hallArray = Object.values(halls);

  // Compute derived comparison metrics for each hall
  const hallMetrics = hallArray.map((h) => {
    const hallRacks = h.rackIds.map((rId) => racks[rId]).filter(Boolean);
    const hallGpuIds = hallRacks.flatMap((r) => r.gpuIds);
    const hallGpus = hallGpuIds.map((gId) => gpus[gId]).filter(Boolean);

    const totalPowerKw = h.totalITPowerKw;
    const avgUtil = hallGpus.length > 0
      ? hallGpus.reduce((s, g) => s + g.utilization, 0) / hallGpus.length
      : 0;
    const avgTemp = h.averageGpuTempC;
    const peakTemp = h.maxGpuTempC;
    const flowKgS = h.coolantFlowKgS;
    const deltaT = Math.max(0, h.coolantReturnTempC - h.coolantSupplyTempC);
    // Performance per kW metric (compute density / power efficiency proxy)
    const perfPerKw = totalPowerKw > 0 ? (avgUtil * 100) / (totalPowerKw / 36) : 0;

    return {
      hall: h,
      rackCount: hallRacks.length,
      gpuCount: hallGpus.length,
      totalPowerKw,
      avgUtil,
      avgTemp,
      peakTemp,
      flowKgS,
      deltaT,
      perfPerKw,
    };
  });

  // Calculate highest metric for relative bar charts
  const maxValues = {
    power: Math.max(...hallMetrics.map((m) => m.totalPowerKw), 1),
    utilization: Math.max(...hallMetrics.map((m) => m.avgUtil), 0.01),
    avgTemp: Math.max(...hallMetrics.map((m) => m.avgTemp), 1),
    peakTemp: Math.max(...hallMetrics.map((m) => m.peakTemp), 1),
    coolantFlow: Math.max(...hallMetrics.map((m) => m.flowKgS), 0.01),
    perfPerKw: Math.max(...hallMetrics.map((m) => m.perfPerKw), 0.01),
  };

  return (
    <div className="dc-hall-analytics-view">
      {/* 1. TOP HEADER & METRIC SELECTOR */}
      <div className="dc-analytics-head">
        <div>
          <h2>Hall-to-Hall Infrastructure Analytics</h2>
          <p>Comparative operational performance, thermal distribution, and liquid-cooling efficiency across all 4 halls.</p>
        </div>
        <div className="dc-metric-tabs">
          <button
            className={selectedMetric === 'power' ? 'active' : ''}
            onClick={() => setSelectedMetric('power')}
          >
            IT Power (kW)
          </button>
          <button
            className={selectedMetric === 'utilization' ? 'active' : ''}
            onClick={() => setSelectedMetric('utilization')}
          >
            GPU Utilization (%)
          </button>
          <button
            className={selectedMetric === 'avgTemp' ? 'active' : ''}
            onClick={() => setSelectedMetric('avgTemp')}
          >
            Average Temp (°C)
          </button>
          <button
            className={selectedMetric === 'peakTemp' ? 'active' : ''}
            onClick={() => setSelectedMetric('peakTemp')}
          >
            Peak Temp (°C)
          </button>
          <button
            className={selectedMetric === 'coolantFlow' ? 'active' : ''}
            onClick={() => setSelectedMetric('coolantFlow')}
          >
            Coolant Flow (kg/s)
          </button>
          <button
            className={selectedMetric === 'perfPerKw' ? 'active' : ''}
            onClick={() => setSelectedMetric('perfPerKw')}
          >
            Efficiency Index
          </button>
        </div>
      </div>

      {/* 2. FOUR EXPANDED HALL SUMMARY CARDS */}
      <div className="dc-hall-cards-grid">
        {hallMetrics.map(({ hall, rackCount, gpuCount, totalPowerKw, avgUtil, avgTemp, peakTemp, flowKgS, deltaT, perfPerKw }) => (
          <div
            key={hall.id}
            className="dc-hall-detail-card"
            style={{ borderTopColor: hall.accentColor }}
          >
            <div className="dc-hall-card-header">
              <div>
                <span className="dc-hall-sub" style={{ color: hall.accentColor }}>{hall.subTitle.toUpperCase()}</span>
                <h3>{hall.name}</h3>
              </div>
              <button
                className="dc-view-in-3d-btn"
                onClick={() => onFocusHallIn3D(hall.id)}
                title="Focus this hall in 3D digital twin"
              >
                <span>3D View</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <p className="dc-hall-desc">{hall.workloadProfile}</p>

            <div className="dc-hall-kpis">
              <div className="dc-hall-kpi">
                <small>IT LOAD</small>
                <strong>{totalPowerKw.toFixed(1)} kW</strong>
              </div>
              <div className="dc-hall-kpi">
                <small>GPU UTIL</small>
                <strong style={{ color: hall.accentColor }}>{(avgUtil * 100).toFixed(0)}%</strong>
              </div>
              <div className="dc-hall-kpi">
                <small>AVG TEMP</small>
                <strong>{avgTemp.toFixed(1)} °C</strong>
              </div>
              <div className="dc-hall-kpi">
                <small>PEAK TEMP</small>
                <strong style={{ color: peakTemp > 75 ? '#f97316' : '#22c55e' }}>{peakTemp.toFixed(1)} °C</strong>
              </div>
            </div>

            <div className="dc-hall-details-list">
              <div className="dc-detail-row">
                <span>Racks / Accelerators:</span>
                <b>{rackCount} Racks · {gpuCount} H100 GPUs</b>
              </div>
              <div className="dc-detail-row">
                <span>Primary Coolant Flow:</span>
                <b>{flowKgS.toFixed(3)} kg/s</b>
              </div>
              <div className="dc-detail-row">
                <span>Coolant ΔT (Return - Supply):</span>
                <b>+{deltaT.toFixed(2)} K (28.0°C → {hall.coolantReturnTempC.toFixed(1)}°C)</b>
              </div>
              <div className="dc-detail-row">
                <span>Heat Generation:</span>
                <b>{(totalPowerKw * 0.985).toFixed(1)} kWth</b>
              </div>
              <div className="dc-detail-row">
                <span>Compute Density Efficiency:</span>
                <b style={{ color: '#22c55e' }}>{perfPerKw.toFixed(1)} pts/kW</b>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. SIDE-BY-SIDE VISUAL COMPARISON CHARTS & RANKINGS */}
      <div className="dc-comparison-section">
        <div className="dc-comp-card">
          <div className="dc-comp-head">
            <BarChart3 size={16} style={{ color: '#38bdf8' }} />
            <h3>Comparative Hall Performance Bar Chart</h3>
            <span className="dc-metric-badge">Metric: {selectedMetric.toUpperCase()}</span>
          </div>

          <div className="dc-comp-bars">
            {hallMetrics.map(({ hall, totalPowerKw, avgUtil, avgTemp, peakTemp, flowKgS, perfPerKw }) => {
              let value = totalPowerKw;
              let label = `${totalPowerKw.toFixed(1)} kW`;
              let max = maxValues.power;

              if (selectedMetric === 'utilization') {
                value = avgUtil;
                label = `${(avgUtil * 100).toFixed(0)}%`;
                max = 1.0;
              } else if (selectedMetric === 'avgTemp') {
                value = avgTemp;
                label = `${avgTemp.toFixed(1)} °C`;
                max = maxValues.avgTemp;
              } else if (selectedMetric === 'peakTemp') {
                value = peakTemp;
                label = `${peakTemp.toFixed(1)} °C`;
                max = maxValues.peakTemp;
              } else if (selectedMetric === 'coolantFlow') {
                value = flowKgS;
                label = `${flowKgS.toFixed(3)} kg/s`;
                max = maxValues.coolantFlow;
              } else if (selectedMetric === 'perfPerKw') {
                value = perfPerKw;
                label = `${perfPerKw.toFixed(1)} idx`;
                max = maxValues.perfPerKw;
              }

              const percentage = Math.min(100, (value / max) * 100);

              return (
                <div key={hall.id} className="dc-bar-item">
                  <div className="dc-bar-info">
                    <span style={{ color: hall.accentColor }}>{hall.name}</span>
                    <strong>{label}</strong>
                  </div>
                  <div className="dc-bar-track">
                    <div
                      className="dc-bar-fill"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: hall.accentColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. PERFORMANCE RANKING & ANALYSIS */}
        <div className="dc-comp-card">
          <div className="dc-comp-head">
            <TrendingUp size={16} style={{ color: '#22c55e' }} />
            <h3>Operational Ranking & Efficiency Analysis</h3>
            <span className="dc-metric-badge">LIVE SIMULATION</span>
          </div>

          <div className="dc-ranking-table">
            <div className="dc-rank-row head">
              <span>Rank</span>
              <span>Hall</span>
              <span>Workload</span>
              <span>IT Load</span>
              <span>Peak Temp</span>
              <span>Status</span>
            </div>
            {[...hallMetrics]
              .sort((a, b) => b.totalPowerKw - a.totalPowerKw)
              .map(({ hall, totalPowerKw, peakTemp }, idx) => (
                <div key={hall.id} className="dc-rank-row" onClick={() => onFocusHallIn3D(hall.id)}>
                  <span className="dc-rank-num">#{idx + 1}</span>
                  <span className="dc-rank-name" style={{ color: hall.accentColor }}>{hall.code}</span>
                  <span>{hall.subTitle}</span>
                  <strong>{totalPowerKw.toFixed(1)} kW</strong>
                  <span style={{ color: peakTemp > 75 ? '#f97316' : '#22c55e' }}>{peakTemp.toFixed(1)} °C</span>
                  <span className="dc-status-badge pass">NORMAL</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
