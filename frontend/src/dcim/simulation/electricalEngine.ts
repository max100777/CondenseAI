/**
 * CondensAI Electrical Power & Network Infrastructure Engine
 *
 * Models 415V 3-phase dual-feed A/B power distribution, transformer & UPS efficiencies,
 * load aggregation with zero double-counting, PUE computation, and path tracing.
 */

import { ENGINEERING_ASSUMPTIONS } from './engineeringAssumptions.ts';
import type { ElectricalState, IntegratedEngineeringState, OperatingStatus } from './engineeringState.ts';

export interface PowerPathNode {
  id: string;
  name: string;
  type: 'Utility' | 'Transformer' | 'Switchgear' | 'UPS' | 'PDU' | 'ServerPSU' | 'GPU';
  voltageV: number;
  feed: 'A' | 'B' | 'Both';
  powerKw: number;
  status: OperatingStatus;
}

export interface NetworkPathNode {
  id: string;
  name: string;
  tier: 'Core' | 'HallDistribution' | 'TopOfRack' | 'ServerNIC' | 'GPUInterconnect';
  bandwidthGbps: number;
  status: 'Operational' | 'Degraded' | 'Offline';
}

export function updateElectrical(state: IntegratedEngineeringState): ElectricalState {
  // 1. Calculate IT power across all servers without double-counting
  let totalITPowerW = 0;

  for (const srv of Object.values(state.servers)) {
    const gpu = state.gpus[srv.gpuId];
    const gpuPower = gpu ? gpu.powerW : 0;
    const chassisElecW =
      (gpuPower + srv.cpuPowerW + srv.memoryPowerW + srv.nicPowerW) /
      ENGINEERING_ASSUMPTIONS.server.psuEfficiency;

    srv.totalElectricalPowerW = chassisElecW;
    srv.heatLoadW = chassisElecW * 0.98;
    totalITPowerW += chassisElecW;
  }

  const facilityITPowerKw = totalITPowerW / 1000.0;

  // 2. Calculate Cooling Plant electrical consumption
  // Pump mechanical power: P = Q * deltaP / pumpEfficiency (~75%)
  const pumpFlowM3S = state.hydraulics.totalSystemFlowKgS / 997.0;
  const pumpDeltaPPa = state.hydraulics.pumpHeadPressureBar * 100000.0;
  const pumpHydraulicPowerW = (pumpFlowM3S * pumpDeltaPPa) / 0.75;
  const coolingElectricalPowerKw = (pumpHydraulicPowerW / 1000.0) + (facilityITPowerKw * 0.08); // pump + CDU auxiliary chiller fans

  // 3. Auxiliary Facility Power (lighting, building management, controls)
  const auxiliaryPowerKw = facilityITPowerKw * 0.02 + 2.0; // 2% + 2 kW base

  // 4. Upstream losses through PDU, UPS, and Transformers
  const pduLossesKw = facilityITPowerKw * (1.0 - ENGINEERING_ASSUMPTIONS.electrical.pduEfficiency);
  const totalSubUPSLoadKw = facilityITPowerKw + pduLossesKw;
  const upsLossesKw = totalSubUPSLoadKw * (1.0 - ENGINEERING_ASSUMPTIONS.electrical.upsEfficiency);
  const transformerInputKw = (totalSubUPSLoadKw + upsLossesKw + coolingElectricalPowerKw + auxiliaryPowerKw) /
    ENGINEERING_ASSUMPTIONS.electrical.transformerEfficiency;

  const facilityTotalPowerKw = transformerInputKw;
  const instantaneousPUE = facilityITPowerKw > 0 ? facilityTotalPowerKw / facilityITPowerKw : 1.0;

  // Water usage effectiveness: L of water consumed per kWh of IT energy
  // CondensAI is net water producing, so WUE reflects net water footprint
  const freshwaterL_H = state.agmd.freshwaterProductionRateL_H;
  const itEnergyKwh_H = facilityITPowerKw;
  const instantaneousWUE = itEnergyKwh_H > 0 ? Math.max(0, 0.25 - (freshwaterL_H / itEnergyKwh_H)) : 0;

  return {
    gridVoltageV: ENGINEERING_ASSUMPTIONS.electrical.utilityVoltageV,
    substationPowerMw: facilityTotalPowerKw / 1000.0,
    mainSwitchgearStatus: 'Normal',
    upsStatus: 'Normal',
    upsBatteryChargePercent: 100.0,
    facilityTotalPowerKw,
    facilityITPowerKw,
    coolingElectricalPowerKw,
    auxiliaryPowerKw,
    instantaneousPUE,
    instantaneousWUE,
  };
}

/**
 * Traces the complete physical electrical power route from utility intake to a specific GPU
 */
export function traceElectricalPath(gpuId: string, state: IntegratedEngineeringState): PowerPathNode[] {
  const gpu = state.gpus[gpuId];
  if (!gpu) return [];
  const srv = state.servers[gpu.serverId];
  const rack = state.racks[gpu.rackId];
  const hall = state.halls[gpu.hallId];

  const gpuPowerKw = gpu.powerW / 1000.0;
  const srvPowerKw = srv ? srv.totalElectricalPowerW / 1000.0 : gpuPowerKw * 1.15;
  const rackPowerKw = rack ? rack.totalITPowerW / 1000.0 : srvPowerKw * 6;
  const hallPowerKw = hall ? hall.totalITPowerKw : rackPowerKw * 6;
  const facilityPowerKw = state.electrical.facilityTotalPowerKw;

  return [
    {
      id: 'GRID-11KV',
      name: 'Utility High-Voltage Intake (11 kV Grid Feed)',
      type: 'Utility',
      voltageV: 11000,
      feed: 'Both',
      powerKw: facilityPowerKw,
      status: 'Normal',
    },
    {
      id: 'TX-MAIN-01',
      name: 'Step-Down Substation Transformer TX-1 (11 kV to 415 V)',
      type: 'Transformer',
      voltageV: 415,
      feed: 'Both',
      powerKw: facilityPowerKw * 0.985,
      status: 'Normal',
    },
    {
      id: 'MSB-SW-01',
      name: 'Main Low-Voltage Switchgear Panel MSB-1',
      type: 'Switchgear',
      voltageV: 415,
      feed: 'Both',
      powerKw: facilityPowerKw * 0.98,
      status: 'Normal',
    },
    {
      id: `UPS-${hall?.code || 'A'}-01`,
      name: `Central 2N Online UPS System (${hall?.name || 'Hall A'})`,
      type: 'UPS',
      voltageV: 415,
      feed: 'Both',
      powerKw: hallPowerKw * 1.05,
      status: 'Normal',
    },
    {
      id: `${rack?.id}-PDU-A`,
      name: `${rack?.id} Dual Smart PDU Feed A & B (415 V 3-Phase)`,
      type: 'PDU',
      voltageV: 415,
      feed: 'Both',
      powerKw: rackPowerKw,
      status: 'Normal',
    },
    {
      id: `${srv?.id}-PSU`,
      name: `${srv?.id} Redundant 80-Plus Titanium Server PSUs`,
      type: 'ServerPSU',
      voltageV: 240,
      feed: 'Both',
      powerKw: srvPowerKw,
      status: 'Normal',
    },
    {
      id: gpu.id,
      name: `${gpu.id} Direct 12V DC Voltage Regulator Module (VRM)`,
      type: 'GPU',
      voltageV: 12,
      feed: 'Both',
      powerKw: gpuPowerKw,
      status: gpu.operatingStatus,
    },
  ];
}

/**
 * Traces the complete data-center network route from core switch to GPU
 */
export function traceNetworkPath(gpuId: string, state: IntegratedEngineeringState): NetworkPathNode[] {
  const gpu = state.gpus[gpuId];
  if (!gpu) return [];
  const srv = state.servers[gpu.serverId];
  const rack = state.racks[gpu.rackId];
  const hall = state.halls[gpu.hallId];

  return [
    {
      id: 'NET-CORE-SPINE-01',
      name: 'Campus High-Throughput Spine Core Switch (800G OSFP)',
      tier: 'Core',
      bandwidthGbps: 51200,
      status: 'Operational',
    },
    {
      id: `NET-DIST-${hall?.code || 'A'}-01`,
      name: `Hall ${hall?.code || 'A'} Leaf Aggregation Distribution Switch`,
      tier: 'HallDistribution',
      bandwidthGbps: 12800,
      status: 'Operational',
    },
    {
      id: `NET-TOR-${rack?.code || 'A01'}`,
      name: `${rack?.id} Top-of-Rack (ToR) Low-Latency Switch`,
      tier: 'TopOfRack',
      bandwidthGbps: 3200,
      status: 'Operational',
    },
    {
      id: `NIC-${srv?.id}`,
      name: `${srv?.id} Dual NVIDIA ConnectX-7 400 Gbps PCIe NIC`,
      tier: 'ServerNIC',
      bandwidthGbps: 800,
      status: 'Operational',
    },
    {
      id: `NVLINK-${gpu.id}`,
      name: `${gpu.id} 900 GB/s NVLink 4.0 / PCIe Gen 5 Fabric`,
      tier: 'GPUInterconnect',
      bandwidthGbps: 7200,
      status: gpu.operatingStatus === 'Normal' ? 'Operational' : 'Degraded',
    },
  ];
}
