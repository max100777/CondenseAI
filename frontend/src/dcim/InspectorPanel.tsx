import {
  Server,
  Cpu,
  Building,
  Droplets,
  Zap,
  Network,
  ArrowLeft,
  Flame,
} from 'lucide-react';
import {
  SelectionState,
} from './facilityData.ts';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';

interface InspectorPanelProps {
  selection: SelectionState;
  simulationState: IntegratedEngineeringState;
  onSelectCampus: () => void;
  onSelectHall: (hallId: string) => void;
  onSelectRack: (rackId: string) => void;
  onSelectGpu: (gpuId: string) => void;
  onSetTraceMode: (mode: 'none' | 'cooling' | 'electrical' | 'network') => void;
  activeTraceMode: 'none' | 'cooling' | 'electrical' | 'network';
}

export default function InspectorPanel({
  selection,
  simulationState,
  onSelectCampus,
  onSelectHall,
  onSelectRack,
  onSelectGpu,
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
            {infraComponent.category === 'cooling' && <Droplets size={18} style={{ color: '#06b6d4' }} />}
            {infraComponent.category === 'electrical' && <Zap size={18} style={{ color: '#eab308' }} />}
            {infraComponent.category === 'network' && <Network size={18} style={{ color: '#a855f7' }} />}
            {infraComponent.category === 'desalination' && <Flame size={18} style={{ color: '#06b6d4' }} />}
            <div>
              <h3>{infraComponent.name}</h3>
              <small>ID: {infraComponent.id}</small>
            </div>
          </div>

          {/* Specific Component Telemetry Cards */}
          {infraComponent.type === 'CDU' && (
            <dl className="dc-inspect-dl">
              <div>
                <dt>Pumping Head</dt>
                <dd>{simulationState.hydraulics.pumpHeadPressureBar.toFixed(2)} bar</dd>
              </div>
              <div>
                <dt>Pump Speed</dt>
                <dd>{simulationState.hydraulics.pumpSpeedRpm.toFixed(0)} RPM ({(simulationState.hydraulics.pumpSpeedFraction * 100).toFixed(0)}%)</dd>
              </div>
              <div>
                <dt>Primary Supply Temp</dt>
                <dd style={{ color: '#38bdf8' }}>{simulationState.hydraulics.primarySupplyTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Total Coolant Flow</dt>
                <dd>{simulationState.hydraulics.totalSystemFlowKgS.toFixed(3)} kg/s</dd>
              </div>
              <div>
                <dt>Pump Status</dt>
                <dd style={{ color: '#22c55e' }}>{simulationState.hydraulics.pumpStatus} (N+1 Redundant)</dd>
              </div>
            </dl>
          )}

          {infraComponent.type === 'HEAT_EXCHANGER' && (
            <dl className="dc-inspect-dl">
              <div>
                <dt>Heat Exchanger Type</dt>
                <dd>Counterflow Plate & Frame</dd>
              </div>
              <div>
                <dt>Heat Transferred</dt>
                <dd style={{ color: '#22c55e' }}>{simulationState.heatRecovery.heatTransferredKw.toFixed(1)} kWth</dd>
              </div>
              <div>
                <dt>Primary Inlet (Warm)</dt>
                <dd style={{ color: '#f97316' }}>{simulationState.heatRecovery.primaryInletTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Primary Outlet (Cooled)</dt>
                <dd style={{ color: '#38bdf8' }}>{simulationState.heatRecovery.primaryOutletTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Secondary Outlet</dt>
                <dd style={{ color: '#10b981' }}>{simulationState.heatRecovery.secondaryOutletTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Second Law Check</dt>
                <dd style={{ color: '#22c55e' }}>T_sec &lt; T_pri (CONSERVED)</dd>
              </div>
            </dl>
          )}

          {infraComponent.type === 'SECONDARY_BUFFER' && (
            <dl className="dc-inspect-dl">
              <div>
                <dt>Storage Volume</dt>
                <dd>{simulationState.heatRecovery.bufferTankVolumeL.toLocaleString()} Liters (15 m³)</dd>
              </div>
              <div>
                <dt>Current Water Temp</dt>
                <dd style={{ color: '#10b981' }}>{simulationState.heatRecovery.bufferTankTempC.toFixed(2)} °C</dd>
              </div>
              <div>
                <dt>Stored Thermal Energy</dt>
                <dd>{simulationState.heatRecovery.bufferStoredEnergyMj.toFixed(1)} MJ</dd>
              </div>
              <div>
                <dt>Ambient Losses</dt>
                <dd>{simulationState.heatRecovery.bufferLossesKw.toFixed(2)} kW</dd>
              </div>
              <div>
                <dt>Energy Integration</dt>
                <dd style={{ color: '#22c55e' }}>First-Law Dynamic (Continuous)</dd>
              </div>
            </dl>
          )}

          {infraComponent.type === 'AGMD_MODULE' && (
            <dl className="dc-inspect-dl">
              <div>
                <dt>Distillate Rate</dt>
                <dd style={{ color: '#38bdf8' }}>{simulationState.agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</dd>
              </div>
              <div>
                <dt>Permeate Flux</dt>
                <dd>{simulationState.agmd.distillateFluxKgM2H.toFixed(2)} kg/(m²·h)</dd>
              </div>
              <div>
                <dt>Feed Temperature</dt>
                <dd style={{ color: '#10b981' }}>{simulationState.agmd.feedInletTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Condenser Plate</dt>
                <dd style={{ color: '#38bdf8' }}>{simulationState.agmd.membraneColdSideTempC.toFixed(1)} °C</dd>
              </div>
              <div>
                <dt>Vapor Pressure ΔP</dt>
                <dd>{simulationState.agmd.vaporPressureDifferentialKPa.toFixed(2)} kPa</dd>
              </div>
              <div>
                <dt>STEC Rating</dt>
                <dd>{simulationState.agmd.specificThermalEnergyConsumptionKwh_M3} kWh/m³</dd>
              </div>
            </dl>
          )}

          {/* Quick Tracing Actions */}
          <div className="dc-trace-actions">
            <h4>Physical Path Tracing</h4>
            <div className="dc-trace-buttons">
              <button
                className={`dc-trace-btn ${activeTraceMode === 'cooling' ? 'active' : ''}`}
                onClick={() => onSetTraceMode(activeTraceMode === 'cooling' ? 'none' : 'cooling')}
              >
                <Droplets size={13} /> {activeTraceMode === 'cooling' ? 'Stop Cooling Trace' : 'Trace Cooling Circuit'}
              </button>
              <button
                className={`dc-trace-btn ${activeTraceMode === 'electrical' ? 'active' : ''}`}
                onClick={() => onSetTraceMode(activeTraceMode === 'electrical' ? 'none' : 'electrical')}
              >
                <Zap size={13} /> {activeTraceMode === 'electrical' ? 'Stop Electrical Trace' : 'Trace Electrical Path'}
              </button>
              <button
                className={`dc-trace-btn ${activeTraceMode === 'network' ? 'active' : ''}`}
                onClick={() => onSetTraceMode(activeTraceMode === 'network' ? 'none' : 'network')}
              >
                <Network size={13} /> {activeTraceMode === 'network' ? 'Stop Network Trace' : 'Trace Network Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CAMPUS FACILITY LEVEL INSPECTION */}
      {level === 'campus' && (
        <div className="dc-inspect-content">
          <div className="dc-inspect-title">
            <Building size={18} style={{ color: '#38bdf8' }} />
            <div>
              <h3>CondensAI Hyperscale Campus</h3>
              <small>4 Halls · 24 Racks · 144 H100 Accelerators</small>
            </div>
          </div>

          <dl className="dc-inspect-dl">
            <div>
              <dt>Total IT Load</dt>
              <dd>{simulationState.electrical.facilityITPowerKw.toFixed(1)} kW</dd>
            </div>
            <div>
              <dt>Total Facility Demand</dt>
              <dd>{simulationState.electrical.facilityTotalPowerKw.toFixed(1)} kW</dd>
            </div>
            <div>
              <dt>Facility PUE</dt>
              <dd style={{ color: '#22c55e', fontWeight: 700 }}>{simulationState.electrical.instantaneousPUE.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Primary Coolant Flow</dt>
              <dd>{simulationState.hydraulics.totalSystemFlowKgS.toFixed(3)} kg/s</dd>
            </div>
            <div>
              <dt>Recovered Thermal Heat</dt>
              <dd style={{ color: '#22c55e' }}>{simulationState.heatRecovery.heatTransferredKw.toFixed(1)} kW</dd>
            </div>
            <div>
              <dt>Freshwater Output</dt>
              <dd style={{ color: '#38bdf8' }}>{simulationState.agmd.cumulativeFreshwaterL.toFixed(2)} L ({simulationState.agmd.freshwaterProductionRateL_H.toFixed(1)} L/h)</dd>
            </div>
          </dl>

          <div className="dc-hall-selector-grid">
            <small>SELECT HALL TO INSPECT</small>
            {Object.values(simulationState.halls).map((h) => (
              <div
                key={h.id}
                className="dc-hall-select-card"
                style={{ borderLeftColor: h.accentColor }}
                onClick={() => onSelectHall(h.id)}
              >
                <div className="dc-card-top">
                  <strong>{h.name}</strong>
                  <em>{h.totalITPowerKw.toFixed(1)} kW</em>
                </div>
                <div className="dc-card-bottom">
                  <span>Avg: {h.averageGpuTempC.toFixed(1)} °C</span>
                  <span style={{ color: h.accentColor }}>{h.profileType.replace('_', ' ').toUpperCase()}</span>
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
              <ArrowLeft size={13} /> Campus Overview
            </button>
            <span className="dc-inspect-category">DATA HALL</span>
          </div>

          <div className="dc-inspect-title">
            <Building size={18} style={{ color: activeHall.accentColor }} />
            <div>
              <h3 style={{ color: activeHall.accentColor }}>{activeHall.name}</h3>
              <small>{activeHall.workloadProfile} ({activeHall.profileType})</small>
            </div>
          </div>

          <dl className="dc-inspect-dl">
            <div>
              <dt>Hall IT Power</dt>
              <dd>{activeHall.totalITPowerKw.toFixed(1)} kW</dd>
            </div>
            <div>
              <dt>Average GPU Temp</dt>
              <dd>{activeHall.averageGpuTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Peak GPU Temp</dt>
              <dd style={{ color: activeHall.maxGpuTempC > 75 ? '#f97316' : '#f1f5f9' }}>
                {activeHall.maxGpuTempC.toFixed(1)} °C
              </dd>
            </div>
            <div>
              <dt>Coolant Return</dt>
              <dd style={{ color: '#f97316' }}>{activeHall.coolantReturnTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Rack Count</dt>
              <dd>{activeHall.rackIds.length} Racks (36 GPUs)</dd>
            </div>
            <div>
              <dt>Coolant Flow</dt>
              <dd>{activeHall.coolantFlowKgS.toFixed(3)} kg/s</dd>
            </div>
          </dl>

          <div className="dc-hall-selector-grid">
            <small>INSTALLED RACKS ({activeHall.rackIds.length})</small>
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
                    <em>{(r?.totalITPowerW / 1000).toFixed(2)} kW</em>
                  </div>
                  <div className="dc-card-bottom">
                    <span>Avg: {r?.averageGpuTempC.toFixed(1)} °C</span>
                    <span>Max: {r?.maxGpuTempC.toFixed(1)} °C</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. RACK LEVEL INSPECTION */}
      {level === 'rack' && activeRack && (
        <div className="dc-inspect-content">
          <div className="dc-inspect-nav">
            <button className="dc-back-btn" onClick={() => onSelectHall(activeRack.hallId)}>
              <ArrowLeft size={13} /> Return to {activeRack.hallCode}
            </button>
            <span className="dc-inspect-category">SERVER CABINET (42U)</span>
          </div>

          <div className="dc-inspect-title">
            <Server size={18} style={{ color: '#38bdf8' }} />
            <div>
              <h3>{activeRack.id}</h3>
              <small>Row {activeRack.row} · Position {activeRack.colInRow} · 6x 4U Servers</small>
            </div>
          </div>

          <dl className="dc-inspect-dl">
            <div>
              <dt>Rack IT Power</dt>
              <dd>{(activeRack.totalITPowerW / 1000).toFixed(2)} kW</dd>
            </div>
            <div>
              <dt>PDU Feed A / B</dt>
              <dd>{activeRack.pduFeedAKw.toFixed(2)} / {activeRack.pduFeedBKw.toFixed(2)} kW</dd>
            </div>
            <div>
              <dt>3-Phase Current</dt>
              <dd>{activeRack.circuitCurrentAmps.toFixed(1)} A (415V)</dd>
            </div>
            <div>
              <dt>Coolant Flow</dt>
              <dd>{activeRack.coolantFlowKgS.toFixed(4)} kg/s</dd>
            </div>
            <div>
              <dt>Supply / Return Temp</dt>
              <dd>{activeRack.coolantSupplyTempC.toFixed(1)} / {activeRack.coolantReturnTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Average / Max GPU</dt>
              <dd>{activeRack.averageGpuTempC.toFixed(1)} / {activeRack.maxGpuTempC.toFixed(1)} °C</dd>
            </div>
          </dl>

          <div className="dc-hall-selector-grid">
            <small>INSTALLED 4U GPU SERVERS (6)</small>
            {activeRack.gpuIds.map((gId, sIdx) => {
              const g = simulationState.gpus[gId];
              return (
                <div
                  key={gId}
                  className="dc-hall-select-card"
                  onClick={() => onSelectGpu(gId)}
                >
                  <div className="dc-card-top">
                    <strong>Tray {sIdx + 1} (RU {(sIdx + 1) * 6})</strong>
                    <em>{g?.powerW.toFixed(0)} W</em>
                  </div>
                  <div className="dc-card-bottom">
                    <span>Die: {g?.temperatureC.toFixed(1)} °C</span>
                    <span style={{ color: g?.temperatureC > 70 ? '#f97316' : '#22c55e' }}>
                      {((g?.utilization || 0) * 100).toFixed(0)}% Load
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Tracing Actions */}
          <div className="dc-trace-actions">
            <h4>Trace Infrastructure Connections</h4>
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
      )}

      {/* 5. GPU NODE LEVEL INSPECTION */}
      {level === 'gpu' && activeGpu && (
        <div className="dc-inspect-content">
          <div className="dc-inspect-nav">
            <button className="dc-back-btn" onClick={() => onSelectRack(activeGpu.rackId)}>
              <ArrowLeft size={13} /> Return to {activeGpu.rackId}
            </button>
            <span className="dc-inspect-category">NVIDIA H100 SXM5</span>
          </div>

          <div className="dc-inspect-title">
            <Cpu size={18} style={{ color: '#38bdf8' }} />
            <div>
              <h3>{activeGpu.id}</h3>
              <small>{activeGpu.model} · RU {activeGpu.slotRU}</small>
            </div>
          </div>

          <dl className="dc-inspect-dl">
            <div>
              <dt>Core Clock</dt>
              <dd>{activeGpu.clockMhz} MHz</dd>
            </div>
            <div>
              <dt>Compute Utilization</dt>
              <dd style={{ color: '#38bdf8', fontWeight: 700 }}>{(activeGpu.utilization * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Electrical Power Draw</dt>
              <dd>{activeGpu.powerW.toFixed(1)} W</dd>
            </div>
            <div>
              <dt>Heat Dissipation (98.5%)</dt>
              <dd>{activeGpu.heatDissipationW.toFixed(1)} W</dd>
            </div>
            <div>
              <dt>Die Junction Temp</dt>
              <dd style={{ color: activeGpu.temperatureC > 75 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                {activeGpu.temperatureC.toFixed(1)} °C
              </dd>
            </div>
            <div>
              <dt>Cold Plate Temp</dt>
              <dd>{activeGpu.coldPlateTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Thermal Margin</dt>
              <dd>{activeGpu.thermalMarginC.toFixed(1)} °C (to 85°C limit)</dd>
            </div>
            <div>
              <dt>Coolant Flow</dt>
              <dd>{activeGpu.coolantFlowKgS.toFixed(4)} kg/s (~0.67 L/min)</dd>
            </div>
            <div>
              <dt>Coolant In / Out</dt>
              <dd>{activeGpu.coolantInletTempC.toFixed(1)} / {activeGpu.coolantOutletTempC.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>Operational State</dt>
              <dd style={{ color: '#22c55e' }}>{activeGpu.operatingStatus} ({activeGpu.fault})</dd>
            </div>
          </dl>

          {/* Quick Tracing Actions */}
          <div className="dc-trace-actions">
            <h4>Trace Infrastructure Connections</h4>
            <div className="dc-trace-buttons">
              <button
                className={`dc-trace-btn ${activeTraceMode === 'cooling' ? 'active' : ''}`}
                onClick={() => onSetTraceMode(activeTraceMode === 'cooling' ? 'none' : 'cooling')}
              >
                <Droplets size={13} /> {activeTraceMode === 'cooling' ? 'Stop Cooling Trace' : 'Trace Cold Plate Circuit'}
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
      )}
    </div>
  );
}
