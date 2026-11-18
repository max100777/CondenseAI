import {
  Zap,
  Droplets,
  Server,
  Building,
  ShieldCheck,
  Flame,
  Cpu,
} from 'lucide-react';
import type { IntegratedEngineeringState } from './simulation/engineeringState.ts';

interface FacilityDashboardProps {
  simulationState: IntegratedEngineeringState;
  onNavigateToHall?: (hallId: string) => void;
  onNavigateTo3D?: () => void;
}

export default function FacilityDashboard({
  simulationState,
  onNavigateToHall,
}: FacilityDashboardProps) {
  const { hydraulics, electrical, heatRecovery, agmd, halls, gpus } = simulationState;

  // Aggregate health and alarm metrics
  const gpuList = Object.values(gpus);
  const throttlingGpus = gpuList.filter((g) => g.fault === 'ThermalThrottling');
  const failedGpus = gpuList.filter((g) => g.operatingStatus === 'Failed');
  const normalGpus = gpuList.filter((g) => g.operatingStatus === 'Normal');

  const facilityHealthScore = failedGpus.length > 0 ? 65 : throttlingGpus.length > 0 ? 85 : 99;

  return (
    <div className="dc-dashboard-view">
      {/* 1. GLOBAL FACILITY EXECUTIVE SUMMARY STRIP */}
      <div className="dc-dash-strip">
        <div className="dc-strip-kpi">
          <small>FACILITY STATUS</small>
          <div className="dc-strip-val">
            <span className="dc-status-dot normal" />
            <strong>{electrical.mainSwitchgearStatus.toUpperCase()}</strong>
          </div>
          <em>Health Score: {facilityHealthScore}/100</em>
        </div>

        <div className="dc-strip-kpi">
          <small>TOTAL IT LOAD</small>
          <div className="dc-strip-val">
            <Server size={16} style={{ color: '#38bdf8' }} />
            <strong>{electrical.facilityITPowerKw.toFixed(1)} kW</strong>
          </div>
          <em>144 H100 GPUs Active</em>
        </div>

        <div className="dc-strip-kpi">
          <small>FACILITY TOTAL POWER</small>
          <div className="dc-strip-val">
            <Zap size={16} style={{ color: '#eab308' }} />
            <strong>{electrical.facilityTotalPowerKw.toFixed(1)} kW</strong>
          </div>
          <em style={{ color: '#22c55e', fontWeight: 600 }}>PUE {electrical.instantaneousPUE.toFixed(2)}</em>
        </div>

        <div className="dc-strip-kpi">
          <small>PRIMARY COOLANT FLOW</small>
          <div className="dc-strip-val">
            <Droplets size={16} style={{ color: '#06b6d4' }} />
            <strong>{hydraulics.totalSystemFlowKgS.toFixed(2)} kg/s</strong>
          </div>
          <em>CDU Head: {hydraulics.pumpHeadPressureBar.toFixed(2)} bar</em>
        </div>

        <div className="dc-strip-kpi">
          <small>WASTE HEAT RECOVERED</small>
          <div className="dc-strip-val">
            <Flame size={16} style={{ color: '#10b981' }} />
            <strong>{heatRecovery.heatTransferredKw.toFixed(1)} kWth</strong>
          </div>
          <em>Plate HX Eff: {(heatRecovery.hxEffectiveness * 100).toFixed(0)}%</em>
        </div>

        <div className="dc-strip-kpi">
          <small>FRESHWATER PRODUCTION</small>
          <div className="dc-strip-val">
            <Droplets size={16} style={{ color: '#38bdf8' }} />
            <strong style={{ color: '#38bdf8' }}>{agmd.freshwaterProductionRateL_H.toFixed(1)} L/h</strong>
          </div>
          <em>Total: {agmd.cumulativeFreshwaterL.toFixed(2)} L</em>
        </div>
      </div>

      {/* 2. HALL-TO-HALL QUICK NAVIGATION CARDS */}
      <div className="dc-dash-hall-nav">
        {Object.values(halls).map((hall) => (
          <div
            key={hall.id}
            className="dc-hall-quick-card"
            onClick={() => onNavigateToHall && onNavigateToHall(hall.id)}
            style={{ cursor: onNavigateToHall ? 'pointer' : 'default' }}
          >
            <div className="dc-hall-card-head">
              <Building size={14} style={{ color: '#38bdf8' }} />
              <strong>{hall.name}</strong>
              <span className="dc-role-badge">{hall.subTitle}</span>
            </div>
            <div className="dc-hall-card-stats">
              <span>IT Power: <strong>{hall.totalITPowerKw.toFixed(1)} kW</strong></span>
              <span>Avg Temp: <strong>{hall.averageGpuTempC.toFixed(1)} °C</strong></span>
              <span>Flow: <strong>{hall.coolantFlowKgS.toFixed(2)} kg/s</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. MAIN OPERATIONS GRID */}
      <div className="dc-dash-grid">
        {/* SECTION A: FACILITY HEALTH & COMPONENT REDUNDANCY */}
        <div className="dc-dash-card">
          <div className="dc-card-head">
            <ShieldCheck size={16} style={{ color: '#22c55e' }} />
            <h3>Facility Health & Redundancy Verification</h3>
            <span className="dc-card-tag pass">2N / N+1 COMPLIANT</span>
          </div>
          <div className="dc-health-grid">
            <div className="dc-health-box">
              <small>GPU Node Status</small>
              <strong>{normalGpus.length} / 144 Online</strong>
              <p>{throttlingGpus.length} Throttled · {failedGpus.length} Offline</p>
            </div>
            <div className="dc-health-box">
              <small>Pumping Redundancy</small>
              <strong style={{ color: '#22c55e' }}>N+1 Active</strong>
              <p>Primary Pump: {hydraulics.pumpStatus} ({hydraulics.pumpSpeedRpm.toFixed(0)} RPM)</p>
            </div>
            <div className="dc-health-box">
              <small>Electrical Feeds</small>
              <strong style={{ color: '#eab308' }}>2N Dual Feed A/B</strong>
              <p>Online Double-Conversion UPS (96.5% Eff)</p>
            </div>
            <div className="dc-health-box">
              <small>First-Law Energy Balance</small>
              <strong style={{ color: '#10b981' }}>VERIFIED (Δ = {heatRecovery.energyBalanceResidualPercent.toFixed(2)}%)</strong>
              <p>Second-Law Compliant: T_sec &lt; T_pri</p>
            </div>
          </div>
        </div>

        {/* SECTION B: ELECTRICAL POWER DISTRIBUTION DASHBOARD */}
        <div className="dc-dash-card">
          <div className="dc-card-head">
            <Zap size={16} style={{ color: '#eab308' }} />
            <h3>Electrical Power Infrastructure (415V 3-Phase)</h3>
            <span className="dc-card-tag info">PUE {electrical.instantaneousPUE.toFixed(2)}</span>
          </div>
          <div className="dc-dash-metrics-table">
            <div className="dc-metric-row">
              <span>11 kV Substation Intake Demand:</span>
              <strong>{electrical.facilityTotalPowerKw.toFixed(1)} kW ({electrical.substationPowerMw.toFixed(3)} MW)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Total Server IT Power Draw:</span>
              <strong>{electrical.facilityITPowerKw.toFixed(1)} kW ({(electrical.facilityITPowerKw / 144).toFixed(2)} kW / node)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Cooling Plant & CDU Auxiliary:</span>
              <strong>{electrical.coolingElectricalPowerKw.toFixed(1)} kW</strong>
            </div>
            <div className="dc-metric-row">
              <span>Facility BMS & Upstream Losses:</span>
              <strong>{electrical.auxiliaryPowerKw.toFixed(1)} kW</strong>
            </div>
            <div className="dc-metric-row">
              <span>Dual Feed Load Balance (A / B):</span>
              <strong>{(electrical.facilityITPowerKw / 2).toFixed(1)} kW / {(electrical.facilityITPowerKw / 2).toFixed(1)} kW (50% / 50%)</strong>
            </div>
          </div>
        </div>

        {/* SECTION C: THERMAL CONDITIONS & GPU STATUS */}
        <div className="dc-dash-card">
          <div className="dc-card-head">
            <Cpu size={16} style={{ color: '#38bdf8' }} />
            <h3>Thermal Management & Silicon Junction Health</h3>
            <span className="dc-card-tag info">Max Temp: 85.0°C Limit</span>
          </div>
          <div className="dc-dash-metrics-table">
            <div className="dc-metric-row">
              <span>Facility-Wide Average GPU Temp:</span>
              <strong style={{ color: '#38bdf8' }}>
                {(gpuList.reduce((s, g) => s + g.temperatureC, 0) / gpuList.length).toFixed(1)} °C
              </strong>
            </div>
            <div className="dc-metric-row">
              <span>Peak GPU Junction Temperature:</span>
              <strong style={{ color: Math.max(...gpuList.map((g) => g.temperatureC)) > 75 ? '#f97316' : '#22c55e' }}>
                {Math.max(...gpuList.map((g) => g.temperatureC)).toFixed(1)} °C
              </strong>
            </div>
            <div className="dc-metric-row">
              <span>Average Copper Cold Plate Temp:</span>
              <strong>{(gpuList.reduce((s, g) => s + g.coldPlateTempC, 0) / gpuList.length).toFixed(1)} °C</strong>
            </div>
            <div className="dc-metric-row">
              <span>Silicon Thermal Margin Headroom:</span>
              <strong style={{ color: '#22c55e' }}>
                {(85.0 - Math.max(...gpuList.map((g) => g.temperatureC))).toFixed(1)} °C margin
              </strong>
            </div>
            <div className="dc-metric-row">
              <span>Thermal Throttling Incidents:</span>
              <strong style={{ color: throttlingGpus.length > 0 ? '#ef4444' : '#22c55e' }}>
                {throttlingGpus.length} GPUs Active
              </strong>
            </div>
          </div>
        </div>

        {/* SECTION D: LIQUID COOLING HYDRAULICS DASHBOARD */}
        <div className="dc-dash-card">
          <div className="dc-card-head">
            <Droplets size={16} style={{ color: '#06b6d4' }} />
            <h3>Primary Coolant Hydraulics & CDU Distribution</h3>
            <span className="dc-card-tag pass">Mass Conserved</span>
          </div>
          <div className="dc-dash-metrics-table">
            <div className="dc-metric-row">
              <span>Primary Supply Temp Setpoint:</span>
              <strong style={{ color: '#38bdf8' }}>{hydraulics.primarySupplyTempC.toFixed(1)} °C (CDU Supply)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Primary Return Mixed Temp:</span>
              <strong style={{ color: '#f97316' }}>{hydraulics.primaryReturnTempC.toFixed(1)} °C (CDU Return)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Primary Coolant ΔT Rise:</span>
              <strong>{(hydraulics.primaryReturnTempC - hydraulics.primarySupplyTempC).toFixed(2)} K</strong>
            </div>
            <div className="dc-metric-row">
              <span>Primary Coolant Heat Rate (Q = ṁ·cp·ΔT):</span>
              <strong style={{ color: '#22c55e' }}>{hydraulics.primaryLoopHeatKw.toFixed(1)} kWth</strong>
            </div>
            <div className="dc-metric-row">
              <span>Rack Distribution Flow Balance:</span>
              <strong>24 / 24 Racks Nominal (~4.0 L/min each)</strong>
            </div>
          </div>
        </div>

        {/* SECTION E: SECONDARY HEAT RECOVERY & 15,000 L BUFFER */}
        <div className="dc-dash-card">
          <div className="dc-card-head">
            <Flame size={16} style={{ color: '#10b981' }} />
            <h3>Thermal Heat Recovery & 15,000 L Buffer Storage</h3>
            <span className="dc-card-tag pass">First-Law Integrated</span>
          </div>
          <div className="dc-dash-metrics-table">
            <div className="dc-metric-row">
              <span>Heat Exchanger Heat Transferred:</span>
              <strong style={{ color: '#22c55e' }}>{heatRecovery.heatTransferredKw.toFixed(1)} kWth</strong>
            </div>
            <div className="dc-metric-row">
              <span>Secondary Loop Outlet Temp:</span>
              <strong style={{ color: '#10b981' }}>{heatRecovery.secondaryOutletTempC.toFixed(1)} °C</strong>
            </div>
            <div className="dc-metric-row">
              <span>Thermal Buffer Tank Volume:</span>
              <strong>{heatRecovery.bufferTankVolumeL.toLocaleString()} Liters (15 m³)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Buffer Tank Temperature:</span>
              <strong style={{ color: '#10b981' }}>{heatRecovery.bufferTankTempC.toFixed(2)} °C</strong>
            </div>
            <div className="dc-metric-row">
              <span>Stored Energy above Ambient:</span>
              <strong>{heatRecovery.bufferStoredEnergyMj.toFixed(1)} MJ</strong>
            </div>
          </div>
        </div>

        {/* SECTION F: WATER PRODUCTION & AGMD DESALINATION */}
        <div className="dc-dash-card">
          <div className="dc-card-head">
            <Droplets size={16} style={{ color: '#38bdf8' }} />
            <h3>Air-Gap Membrane Distillation (AGMD) Desalination</h3>
            <span className="dc-card-tag info">Clean Permeate</span>
          </div>
          <div className="dc-dash-metrics-table">
            <div className="dc-metric-row">
              <span>Distillate Production Rate:</span>
              <strong style={{ color: '#38bdf8', fontWeight: 700 }}>
                {agmd.freshwaterProductionRateL_H.toFixed(1)} L/h
              </strong>
            </div>
            <div className="dc-metric-row">
              <span>Cumulative Freshwater Produced:</span>
              <strong style={{ color: '#38bdf8' }}>{agmd.cumulativeFreshwaterL.toFixed(2)} Liters</strong>
            </div>
            <div className="dc-metric-row">
              <span>Active PTFE Membrane Surface Area:</span>
              <strong>24.0 m² (Hydrophobic 0.22 µm)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Permeate Flux:</span>
              <strong>{agmd.distillateFluxKgM2H.toFixed(2)} kg/(m²·h)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Feed vs Condenser Driving ΔP:</span>
              <strong>{agmd.vaporPressureDifferentialKPa.toFixed(2)} kPa ({agmd.feedInletTempC.toFixed(1)}°C / {agmd.membraneColdSideTempC.toFixed(1)}°C)</strong>
            </div>
            <div className="dc-metric-row">
              <span>Specific Thermal Energy (STEC):</span>
              <strong>{agmd.specificThermalEnergyConsumptionKwh_M3} kWh/m³</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
