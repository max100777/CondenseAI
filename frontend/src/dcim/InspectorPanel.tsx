import {
  Server,
  Cpu,
  Building,
  Droplets,
  Zap,
  Network,
  ArrowLeft,
  Flame,
  Sliders,
  Activity,
} from 'lucide-react';
import { SelectionState } from './facilityData.ts';
import type { IntegratedEngineeringState, GpuEntity } from './simulation/engineeringState.ts';

interface InspectorPanelProps {
  selection: SelectionState;
  simulationState: IntegratedEngineeringState;
  extendedTrayId?: string | null;
  allTraysOpen?: boolean;
  rackViewMode?: 'front' | 'rear' | 'close';
  hoveredComponent?: string | null;
  onSelectCampus: () => void;
  onSelectHall: (hallId: string) => void;
  onSelectRack: (rackId: string) => void;
  onSelectGpu: (gpuId: string) => void;
  onToggleExtendTray?: (gpuId: string) => void;
  onToggleAllTrays?: () => void;
  onChangeRackViewMode?: (mode: 'front' | 'rear' | 'close') => void;
  onSetTraceMode: (mode: 'none' | 'cooling' | 'electrical' | 'network') => void;
  activeTraceMode: 'none' | 'cooling' | 'electrical' | 'network';
}

export default function InspectorPanel({
  selection,
  simulationState,
  extendedTrayId,
  allTraysOpen = false,
  rackViewMode = 'front',
  hoveredComponent,
  onSelectCampus,
  onSelectHall,
  onSelectRack,
  onSelectGpu,
  onToggleExtendTray,
  onToggleAllTrays,
  onChangeRackViewMode,
  onSetTraceMode,
  activeTraceMode,
}: InspectorPanelProps) {
  const { level, hallId, rackId, gpuId, infraComponent } = selection;

  // Selected Entities
  const activeHall = hallId ? simulationState.halls[hallId] : null;
  const activeRack = rackId ? simulationState.racks[rackId] : null;
  const activeGpu = gpuId ? simulationState.gpus[gpuId] : null;

  return (
    <div className="dc-inspector-panel">
      {/* 1. INFRASTRUCTURE COMPONENT INSPECTION */}
      {level === 'infrastructure' && infraComponent && (
        <div className="dc-inspect-content">
          <div className="dc-inspect-nav">
            <button className="dc-back-btn" onClick={onSelectCampus}>
              <ArrowLeft size={13} /> Campus Overview
            </button>
            <span className="dc-inspect-category">{infraComponent.category.toUpperCase()}</span>
          </div>

          <div className="dc-inspect-title">
            <Droplets size={18} style={{ color: '#06b6d4' }} />
            <div>
              <h3>{infraComponent.name}</h3>
              <small>{infraComponent.type} · Physical Model Node</small>
            </div>
          </div>

          <div className="dc-inspect-tags">
            <span className="dc-tag active">ONLINE</span>
            <span className="dc-tag">N+1 ACTIVE</span>
          </div>

          <dl className="dc-inspect-dl">
            <div>
              <dt>Component ID</dt>
              <dd>{infraComponent.id}</dd>
            </div>
            <div>
              <dt>System Domain</dt>
              <dd>{infraComponent.category.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Primary Flow Rate</dt>
              <dd>{simulationState.hydraulics.totalSystemFlowKgS.toFixed(2)} kg/s</dd>
            </div>
            <div>
              <dt>Operating Head</dt>
              <dd>{simulationState.hydraulics.pumpHeadPressureBar.toFixed(2)} bar</dd>
            </div>
            <div>
              <dt>Recovered Heat</dt>
              <dd>{simulationState.heatRecovery.heatTransferredKw.toFixed(1)} kWth</dd>
            </div>
            <div>
              <dt>Water Desalination Rate</dt>
              <dd>{simulationState.agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 2. CAMPUS OVERVIEW INSPECTION */}
      {level === 'campus' && (
        <div className="dc-inspect-content">
          <div className="dc-inspect-nav">
            <span className="dc-inspect-category">HYPERSCALE FACILITY</span>
          </div>

          <div className="dc-inspect-title">
            <Building size={18} style={{ color: '#38bdf8' }} />
            <div>
              <h3>CondensAI Hyperscale Campus</h3>
              <small>4 Data Halls · 24 Racks · 144 H100 Accelerators</small>
            </div>
          </div>

          <div className="dc-inspect-kpis">
            <div className="dc-mini-kpi">
              <small>TOTAL IT POWER</small>
              <strong>{simulationState.electrical.facilityITPowerKw.toFixed(1)} kW</strong>
            </div>
            <div className="dc-mini-kpi">
              <small>INSTANT PUE</small>
              <strong style={{ color: '#22c55e' }}>{simulationState.electrical.instantaneousPUE.toFixed(2)}</strong>
            </div>
            <div className="dc-mini-kpi">
              <small>HEAT RECOVERED</small>
              <strong style={{ color: '#10b981' }}>{simulationState.heatRecovery.heatTransferredKw.toFixed(1)} kWth</strong>
            </div>
            <div className="dc-mini-kpi">
              <small>DESALINATION RATE</small>
              <strong style={{ color: '#38bdf8' }}>{simulationState.agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</strong>
            </div>
          </div>

          <div className="dc-hall-selector-grid">
            <small>SELECT DATA HALL TO ZOOM</small>
            {Object.values(simulationState.halls).map((h) => (
              <div
                key={h.id}
                className="dc-hall-select-card"
                onClick={() => onSelectHall(h.id)}
              >
                <div className="dc-card-top">
                  <strong>{h.name}</strong>
                  <span style={{ color: h.accentColor }}>{h.subTitle}</span>
                </div>
                <div className="dc-card-bottom">
                  <span>{h.totalITPowerKw.toFixed(1)} kW</span>
                  <span>{h.averageGpuTempC.toFixed(1)} °C</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. HALL LEVEL INSPECTION */}
      {level === 'hall' && activeHall && (
        <div className="dc-inspect-content">
          <div className="dc-inspect-nav">
            <button className="dc-back-btn" onClick={onSelectCampus}>
              <ArrowLeft size={13} /> Return to Campus
            </button>
            <span className="dc-inspect-category">DATA HALL</span>
          </div>

          <div className="dc-inspect-title">
            <Building size={18} style={{ color: activeHall.accentColor }} />
            <div>
              <h3>{activeHall.name}</h3>
              <small>{activeHall.workloadProfile} · 6 Racks · 36 GPUs</small>
            </div>
          </div>

          <dl className="dc-inspect-dl">
            <div>
              <dt>Total IT Power</dt>
              <dd>{activeHall.totalITPowerKw.toFixed(1)} kW</dd>
            </div>
            <div>
              <dt>Coolant Mass Flow</dt>
              <dd>{activeHall.coolantFlowKgS.toFixed(3)} kg/s</dd>
            </div>
            <div>
              <dt>Supply / Return Temp</dt>
              <dd>{activeHall.coolantSupplyTempC.toFixed(1)} / {activeHall.coolantReturnTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Avg Silicon Temp</dt>
              <dd>{activeHall.averageGpuTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Peak Silicon Temp</dt>
              <dd style={{ color: activeHall.maxGpuTempC > 75 ? '#ef4444' : '#22c55e' }}>
                {activeHall.maxGpuTempC.toFixed(1)} °C
              </dd>
            </div>
          </dl>

          <div className="dc-hall-selector-grid">
            <small>INSTALLED 42U RACKS ({activeHall.rackIds.length})</small>
            {activeHall.rackIds.map((rId) => {
              const r = simulationState.racks[rId];
              return (
                <div
                  key={rId}
                  className="dc-hall-select-card"
                  onClick={() => onSelectRack(rId)}
                >
                  <div className="dc-card-top">
                    <strong>{rId}</strong>
                    <em>{((r?.totalITPowerW || 0) / 1000).toFixed(1)} kW</em>
                  </div>
                  <div className="dc-card-bottom">
                    <span>Avg {r?.averageGpuTempC.toFixed(1)} °C</span>
                    <span>Max {r?.maxGpuTempC.toFixed(1)} °C</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. RACK LEVEL INSPECTION — 6 GPU COMPARISON & RETRACTABLE TRAY CONTROLS */}
      {level === 'rack' && activeRack && (() => {
        const rackGpus: GpuEntity[] = activeRack.gpuIds.map((id) => simulationState.gpus[id]).filter(Boolean);
        const hottestGpu = rackGpus.reduce((prev, curr) => (curr.temperatureC > prev.temperatureC ? curr : prev), rackGpus[0]);
        const highestPowerGpu = rackGpus.reduce((prev, curr) => (curr.powerW > prev.powerW ? curr : prev), rackGpus[0]);
        const lowestFlowGpu = rackGpus.reduce((prev, curr) => (curr.coolantFlowKgS < prev.coolantFlowKgS ? curr : prev), rackGpus[0]);
        const totalCoolantFlowLMin = activeRack.coolantFlowKgS * 60.0;
        const totalHeatRemovedKw = rackGpus.reduce((sum, g) => sum + g.heatDissipationW, 0) / 1000.0;

        return (
          <div className="dc-inspect-content">
            <div className="dc-inspect-nav">
              <button className="dc-back-btn" onClick={() => onSelectHall(activeRack.hallId)}>
                <ArrowLeft size={13} /> Return to {activeRack.hallCode}
              </button>
              <span className="dc-inspect-category">42U GPU SERVER RACK</span>
            </div>

            <div className="dc-inspect-title">
              <Server size={18} style={{ color: '#38bdf8' }} />
              <div>
                <h3>{activeRack.id}</h3>
                <small>Row {activeRack.row} · Col {activeRack.colInRow} · 6x Retractable 4U Compute Sleds</small>
              </div>
            </div>

            {/* Quick Tray Showcase Controls */}
            <div className="dc-rack-actions-bar">
              <button
                className={`dc-rack-action-btn ${allTraysOpen ? 'active' : ''}`}
                onClick={onToggleAllTrays}
                title="Extend all 6 compute sleds forward along slide rails"
              >
                <Sliders size={13} />
                <span>{allTraysOpen ? 'Retract All Trays' : 'Open All 6 Trays'}</span>
              </button>

              {onChangeRackViewMode && (
                <div className="dc-view-mode-toggle">
                  <button
                    className={rackViewMode === 'front' ? 'active' : ''}
                    onClick={() => onChangeRackViewMode('front')}
                    title="Inspect Front Sled Faceplates"
                  >
                    Front
                  </button>
                  <button
                    className={rackViewMode === 'rear' ? 'active' : ''}
                    onClick={() => onChangeRackViewMode('rear')}
                    title="Inspect Rear Manifolds & PDUs"
                  >
                    Rear
                  </button>
                  <button
                    className={rackViewMode === 'close' ? 'active' : ''}
                    onClick={() => onChangeRackViewMode('close')}
                    title="Close-Up Hardware Perspective"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            {/* Aggregated Rack Engineering KPIs */}
            <dl className="dc-inspect-dl">
              <div>
                <dt>Total Rack IT Power</dt>
                <dd>{(activeRack.totalITPowerW / 1000).toFixed(2)} kW</dd>
              </div>
              <div>
                <dt>Dual Feed A / B</dt>
                <dd>{activeRack.pduFeedAKw.toFixed(2)} / {activeRack.pduFeedBKw.toFixed(2)} kW</dd>
              </div>
              <div>
                <dt>Coolant Flow Rate</dt>
                <dd>{totalCoolantFlowLMin.toFixed(2)} L/min ({activeRack.coolantFlowKgS.toFixed(4)} kg/s)</dd>
              </div>
              <div>
                <dt>Coolant In / Out</dt>
                <dd>{activeRack.coolantSupplyTempC.toFixed(1)} / {activeRack.coolantReturnTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Average GPU Temp</dt>
                <dd>{activeRack.averageGpuTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Peak Junction Temp</dt>
                <dd style={{ color: activeRack.maxGpuTempC > 75 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                  {activeRack.maxGpuTempC.toFixed(1)} °C
                </dd>
              </div>
              <div>
                <dt>Heat Dissipated</dt>
                <dd>{totalHeatRemovedKw.toFixed(2)} kWth</dd>
              </div>
              <div>
                <dt>3-Phase Current</dt>
                <dd>{activeRack.circuitCurrentAmps.toFixed(1)} A @ 415V</dd>
              </div>
            </dl>

            {/* 6-GPU RACK ENGINEERING TABLE */}
            <div className="dc-rack-gpus-section">
              <div className="dc-section-head">
                <h4>6x GPU Compute Sleds (Click to Slide Out)</h4>
                <small>Individual SXM5 Accelerator Telemetry</small>
              </div>

              <div className="dc-gpu-table-wrapper">
                <table className="dc-gpu-table">
                  <thead>
                    <tr>
                      <th>Tray</th>
                      <th>GPU ID</th>
                      <th>Temp</th>
                      <th>Power</th>
                      <th>Flow</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rackGpus.map((g, idx) => {
                      const isExtended = allTraysOpen || extendedTrayId === g.id;
                      const isHottest = hottestGpu && g.id === hottestGpu.id;
                      const isHighestPower = highestPowerGpu && g.id === highestPowerGpu.id;
                      const isLowestFlow = lowestFlowGpu && g.id === lowestFlowGpu.id;

                      return (
                        <tr
                          key={g.id}
                          className={`dc-gpu-row ${isExtended ? 'extended' : ''}`}
                          onClick={() => {
                            onSelectGpu(g.id);
                            if (onToggleExtendTray) onToggleExtendTray(g.id);
                          }}
                        >
                          <td>
                            <strong>T0{idx + 1}</strong>
                            <small>RU {g.slotRU}</small>
                          </td>
                          <td>
                            <span className="dc-gpu-cell-id">{g.id.replace('GPU ', '')}</span>
                            {isHottest && <span className="dc-mini-badge hot">HOT</span>}
                            {isHighestPower && <span className="dc-mini-badge power">PWR</span>}
                            {isLowestFlow && <span className="dc-mini-badge flow">FLOW</span>}
                          </td>
                          <td style={{ color: g.temperatureC > 72 ? '#f97316' : '#22c55e', fontWeight: 600 }}>
                            {g.temperatureC.toFixed(1)}°C
                          </td>
                          <td>{g.powerW.toFixed(0)} W</td>
                          <td>{(g.coolantFlowKgS * 60).toFixed(2)} L/m</td>
                          <td>
                            <span className={`dc-status-dot ${g.operatingStatus.toLowerCase()}`} />
                            <small>{g.operatingStatus}</small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Tracing Actions */}
            <div className="dc-trace-actions">
              <h4>Trace Physical Connections</h4>
              <div className="dc-trace-buttons">
                <button
                  className={`dc-trace-btn ${activeTraceMode === 'cooling' ? 'active' : ''}`}
                  onClick={() => onSetTraceMode(activeTraceMode === 'cooling' ? 'none' : 'cooling')}
                >
                  <Droplets size={13} /> {activeTraceMode === 'cooling' ? 'Clear Cooling Trace' : 'Trace Rack Coolant Loop'}
                </button>
                <button
                  className={`dc-trace-btn ${activeTraceMode === 'electrical' ? 'active' : ''}`}
                  onClick={() => onSetTraceMode(activeTraceMode === 'electrical' ? 'none' : 'electrical')}
                >
                  <Zap size={13} /> {activeTraceMode === 'electrical' ? 'Clear Electrical Trace' : 'Trace Dual A/B Feeds'}
                </button>
                <button
                  className={`dc-trace-btn ${activeTraceMode === 'network' ? 'active' : ''}`}
                  onClick={() => onSetTraceMode(activeTraceMode === 'network' ? 'none' : 'network')}
                >
                  <Network size={13} /> {activeTraceMode === 'network' ? 'Clear Network Trace' : 'Trace ToR Network Link'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. GPU NODE LEVEL INSPECTION — DETAILED ACCELERATOR TELEMETRY */}
      {level === 'gpu' && activeGpu && (() => {
        // Detailed Electrical & Fluid calculations
        const coreVoltageV = 0.92; // Nominal GPU core VDD
        const coreCurrentA = (activeGpu.powerW / coreVoltageV);
        const rackBusCurrentA = (activeGpu.powerW / 48.0); // 48V rack busbar
        const coolantFlowLMin = activeGpu.coolantFlowKgS * 60.0;
        const heatDissipationKw = activeGpu.heatDissipationW / 1000.0;
        const deltaTCoolant = Math.max(0, activeGpu.coolantOutletTempC - activeGpu.coolantInletTempC);
        const pressureDropKPa = 12.4; // Micro-channel cold-plate hydraulic drop
        const energyConsumedKWh = (activeGpu.powerW * (simulationState.clock.simTimeSeconds / 3600)) / 1000.0;
        const isTrayExtended = Boolean(allTraysOpen || extendedTrayId === activeGpu.id);

        return (
          <div className="dc-inspect-content">
            <div className="dc-inspect-nav">
              <button className="dc-back-btn" onClick={() => onSelectRack(activeGpu.rackId)}>
                <ArrowLeft size={13} /> Return to {activeGpu.rackId}
              </button>
              <span className="dc-inspect-category">NVIDIA H100 SXM5 (80GB)</span>
            </div>

            <div className="dc-inspect-title">
              <Cpu size={18} style={{ color: '#38bdf8' }} />
              <div>
                <h3>{activeGpu.id}</h3>
                <small>{activeGpu.model} · RU {activeGpu.slotRU} · {activeGpu.rackId}</small>
              </div>
            </div>

            {/* Tray Slide Animation Controls */}
            <div className="dc-tray-controls-banner">
              <button
                className={`dc-slide-tray-btn ${isTrayExtended ? 'extended' : ''}`}
                onClick={() => onToggleExtendTray && onToggleExtendTray(activeGpu.id)}
                title="Trigger physical slide-out on ball-bearing rails"
              >
                <Sliders size={13} />
                <span>{isTrayExtended ? 'Retract Compute Sled' : 'Slide Out Compute Sled'}</span>
              </button>
            </div>

            {/* Hovered Component Callout Box */}
            {hoveredComponent && (
              <div className="dc-hover-component-badge">
                <small>INSPECTING COMPONENT</small>
                <strong>{hoveredComponent}</strong>
              </div>
            )}

            {/* SECTION A: THERMAL SILICON JUNCTION & COLD PLATE */}
            <div className="dc-inspect-section">
              <div className="dc-section-header">
                <Flame size={14} style={{ color: '#f97316' }} />
                <span>Silicon Junction & Cold Plate</span>
              </div>
              <dl className="dc-inspect-dl compact">
                <div>
                  <dt>Silicon Die Junction (T_j)</dt>
                  <dd style={{ color: activeGpu.temperatureC > 75 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                    {activeGpu.temperatureC.toFixed(1)} °C
                  </dd>
                </div>
                <div>
                  <dt>Copper Cold Plate (T_cp)</dt>
                  <dd>{activeGpu.coldPlateTempC.toFixed(1)} °C</dd>
                </div>
                <div>
                  <dt>Thermal Margin to 85°C</dt>
                  <dd>{activeGpu.thermalMarginC.toFixed(1)} °C</dd>
                </div>
                <div>
                  <dt>Heat Dissipated to Coolant</dt>
                  <dd>{activeGpu.heatDissipationW.toFixed(1)} W ({heatDissipationKw.toFixed(3)} kWth)</dd>
                </div>
              </dl>
            </div>

            {/* SECTION B: ELECTRICAL POWER & ENERGY */}
            <div className="dc-inspect-section">
              <div className="dc-section-header">
                <Zap size={14} style={{ color: '#eab308' }} />
                <span>Electrical Power & Delivery</span>
              </div>
              <dl className="dc-inspect-dl compact">
                <div>
                  <dt>Total Power Draw</dt>
                  <dd style={{ color: '#eab308', fontWeight: 700 }}>{activeGpu.powerW.toFixed(1)} W</dd>
                </div>
                <div>
                  <dt>Core VDD Voltage</dt>
                  <dd>{coreVoltageV.toFixed(2)} V</dd>
                </div>
                <div>
                  <dt>Core Current (I_vdd)</dt>
                  <dd>{coreCurrentA.toFixed(0)} A</dd>
                </div>
                <div>
                  <dt>48V Busbar Input Current</dt>
                  <dd>{rackBusCurrentA.toFixed(1)} A</dd>
                </div>
                <div>
                  <dt>Cumulative Energy</dt>
                  <dd>{energyConsumedKWh.toFixed(3)} kWh</dd>
                </div>
              </dl>
            </div>

            {/* SECTION C: CLOSED-LOOP LIQUID COOLING HYDRAULICS */}
            <div className="dc-inspect-section">
              <div className="dc-section-header">
                <Droplets size={14} style={{ color: '#06b6d4' }} />
                <span>Liquid Cooling Hydronics</span>
              </div>
              <dl className="dc-inspect-dl compact">
                <div>
                  <dt>Coolant Flow Rate</dt>
                  <dd style={{ color: '#06b6d4', fontWeight: 700 }}>
                    {coolantFlowLMin.toFixed(2)} L/min ({activeGpu.coolantFlowKgS.toFixed(4)} kg/s)
                  </dd>
                </div>
                <div>
                  <dt>Circuit Mode</dt>
                  <dd style={{ color: '#22c55e' }}>Closed-Loop (0 L consumed)</dd>
                </div>
                <div>
                  <dt>Inlet / Outlet Temp</dt>
                  <dd>{activeGpu.coolantInletTempC.toFixed(1)} / {activeGpu.coolantOutletTempC.toFixed(1)} °C</dd>
                </div>
                <div>
                  <dt>Coolant Rise (ΔT)</dt>
                  <dd>+{deltaTCoolant.toFixed(2)} K</dd>
                </div>
                <div>
                  <dt>Cold Plate Pressure Drop</dt>
                  <dd>{pressureDropKPa.toFixed(1)} kPa</dd>
                </div>
              </dl>
            </div>

            {/* SECTION D: COMPUTE PERFORMANCE & WORKLOAD */}
            <div className="dc-inspect-section">
              <div className="dc-section-header">
                <Activity size={14} style={{ color: '#a855f7' }} />
                <span>Compute Performance</span>
              </div>
              <dl className="dc-inspect-dl compact">
                <div>
                  <dt>GPU Compute Utilization</dt>
                  <dd style={{ color: '#38bdf8', fontWeight: 700 }}>{(activeGpu.utilization * 100).toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Core Clock Speed</dt>
                  <dd>{activeGpu.clockMhz} MHz</dd>
                </div>
                <div>
                  <dt>VRAM Memory Bandwidth</dt>
                  <dd>80GB HBM3 @ 3.35 TB/s</dd>
                </div>
                <div>
                  <dt>Operational State</dt>
                  <dd style={{ color: activeGpu.operatingStatus === 'Normal' ? '#22c55e' : '#ef4444' }}>
                    {activeGpu.operatingStatus} ({activeGpu.fault})
                  </dd>
                </div>
              </dl>
            </div>

            {/* SECTION E: REAL-TIME TIME-SERIES SPARKLINE CHARTS */}
            <div className="dc-inspect-section">
              <div className="dc-section-header">
                <Activity size={14} style={{ color: '#38bdf8' }} />
                <span>Live GPU Telemetry Sparklines</span>
              </div>
              <div className="dc-sparkline-group">
                <div className="dc-spark-card">
                  <small>TEMPERATURE HISTORY (°C)</small>
                  <svg viewBox="0 0 100 24" className="dc-spark-svg">
                    <polyline
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.8"
                      points={
                        activeGpu.history && activeGpu.history.length > 1
                          ? activeGpu.history
                              .map((pt, i) => `${(i / (activeGpu.history.length - 1)) * 100},${24 - Math.max(0, Math.min(24, (pt.tempC - 35) * 0.5))}`)
                              .join(' ')
                          : '0,14 25,12 50,15 75,13 100,12'
                      }
                    />
                  </svg>
                  <strong>{activeGpu.temperatureC.toFixed(1)} °C</strong>
                </div>

                <div className="dc-spark-card">
                  <small>POWER DRAW HISTORY (W)</small>
                  <svg viewBox="0 0 100 24" className="dc-spark-svg">
                    <polyline
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="1.8"
                      points={
                        activeGpu.history && activeGpu.history.length > 1
                          ? activeGpu.history
                              .map((pt, i) => `${(i / (activeGpu.history.length - 1)) * 100},${24 - Math.max(0, Math.min(24, (pt.powerW - 200) * 0.04))}`)
                              .join(' ')
                          : '0,15 25,11 50,14 75,12 100,10'
                      }
                    />
                  </svg>
                  <strong>{activeGpu.powerW.toFixed(0)} W</strong>
                </div>
              </div>
            </div>

            {/* Quick Tracing Actions */}
            <div className="dc-trace-actions">
              <h4>Trace Physical Connectivity</h4>
              <div className="dc-trace-buttons">
                <button
                  className={`dc-trace-btn ${activeTraceMode === 'cooling' ? 'active' : ''}`}
                  onClick={() => onSetTraceMode(activeTraceMode === 'cooling' ? 'none' : 'cooling')}
                >
                  <Droplets size={13} /> {activeTraceMode === 'cooling' ? 'Stop Cooling Trace' : 'Trace Cold Plate Loop'}
                </button>
                <button
                  className={`dc-trace-btn ${activeTraceMode === 'electrical' ? 'active' : ''}`}
                  onClick={() => onSetTraceMode(activeTraceMode === 'electrical' ? 'none' : 'electrical')}
                >
                  <Zap size={13} /> {activeTraceMode === 'electrical' ? 'Stop Electrical Trace' : 'Trace Substation to GPU'}
                </button>
                <button
                  className={`dc-trace-btn ${activeTraceMode === 'network' ? 'active' : ''}`}
                  onClick={() => onSetTraceMode(activeTraceMode === 'network' ? 'none' : 'network')}
                >
                  <Network size={13} /> {activeTraceMode === 'network' ? 'Stop Network Trace' : 'Trace Core to GPU NIC'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
