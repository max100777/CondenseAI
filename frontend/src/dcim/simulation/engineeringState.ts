/**
 * CondensAI Engineering Simulation State & Hardware Topology
 * Single Source of Truth for GPU, Server, Rack, Hydraulic, Electrical, Thermal, and AGMD Subsystems
 */

import { ENGINEERING_ASSUMPTIONS } from './engineeringAssumptions.ts';

export type OperatingStatus = 'Normal' | 'Warning' | 'Degraded' | 'Failed' | 'Offline';
export type ComponentFault = 'None' | 'ThermalThrottling' | 'PumpTrip' | 'PduTrip' | 'ValvRestriction' | 'MembraneFouling';

export interface GpuEntity {
  id: string; // e.g. "GPU A01-GPU01"
  name: string;
  rackId: string; // "Rack A01"
  serverId: string; // "SRV A01-01"
  hallId: string; // "HALL-A"
  indexInRack: number; // 0 to 5
  gpuNumber: number; // 1 to 6
  slotRU: number; // rack RU position
  model: string;
  utilization: number; // 0.0 to 1.0 (0% to 100%)
  powerW: number; // Electrical power draw (Watts)
  heatDissipationW: number; // Thermal power dissipated into cold plate (Watts)
  temperatureC: number; // Silicon die junction temperature (°C)
  coldPlateTempC: number; // Copper cold-plate base temperature (°C)
  thermalLimitC: number; // Max safe temperature (85°C)
  thermalMarginC: number; // thermalLimitC - temperatureC
  clockMhz: number; // Operating core clock (MHz)
  coolantFlowKgS: number; // Coolant mass flow through cold plate (kg/s)
  coolantInletTempC: number; // Coolant temp entering cold plate (°C)
  coolantOutletTempC: number; // Coolant temp exiting cold plate (°C)
  operatingStatus: OperatingStatus;
  fault: ComponentFault;
  history: Array<{ time: number; tempC: number; powerW: number }>;
}

export interface ServerEntity {
  id: string; // e.g. "SRV A01-01"
  rackId: string; // "Rack A01"
  hallId: string; // "HALL-A"
  slotRU: number; // e.g. 6, 12, 18, 24, 30, 36
  heightRU: number; // 4U
  gpuId: string; // "GPU A01-GPU01"
  cpuPowerW: number;
  memoryPowerW: number;
  nicPowerW: number;
  totalElectricalPowerW: number; // (gpuPower + cpu + mem + nic) / psuEfficiency
  heatLoadW: number; // Total server heat generation (Watts)
  psuAFault: boolean;
  psuBFault: boolean;
  status: OperatingStatus;
}

export interface RackEntity {
  id: string; // "Rack A01"
  code: string; // "A01"
  hallId: string; // "HALL-A"
  hallCode: string; // "A"
  rackNumber: number; // 1 to 6
  row: number; // 1 or 2
  colInRow: number; // 1 to 3
  position: [number, number, number];
  facingZ: number;
  ruHeight: number; // 42U
  occupiedRU: number; // 24U
  serverIds: string[];
  gpuIds: string[];
  // Aggregated Electrical State
  totalITPowerW: number;
  pduFeedAKw: number;
  pduFeedBKw: number;
  circuitCurrentAmps: number;
  // Aggregated Hydraulic & Thermal State
  coolantSupplyTempC: number;
  coolantReturnTempC: number;
  coolantFlowKgS: number;
  pressureDropKPa: number;
  averageGpuTempC: number;
  maxGpuTempC: number;
  heatLoadKw: number;
  status: OperatingStatus;
}

export interface HallEntity {
  id: string; // "HALL-A"
  code: string; // "A"
  name: string;
  subTitle: string;
  workloadProfile: string;
  profileType: 'ai_training' | 'ai_inference' | 'hpc_research' | 'experimental';
  accentColor: string;
  targetAisleTempC: number;
  rackIds: string[];
  // Aggregated Metrics
  totalITPowerKw: number;
  coolantFlowKgS: number;
  coolantSupplyTempC: number;
  coolantReturnTempC: number;
  averageGpuTempC: number;
  maxGpuTempC: number;
  status: OperatingStatus;
}

export interface HydraulicState {
  pumpStatus: OperatingStatus;
  pumpSpeedRpm: number;
  pumpSpeedFraction: number; // 0.0 to 1.0
  totalSystemFlowKgS: number;
  pumpHeadPressureBar: number;
  primarySupplyTempC: number;
  primaryReturnTempC: number;
  primaryLoopHeatKw: number;
  hallFlowsKgS: Record<string, number>; // hallId -> flow
  rackFlowsKgS: Record<string, number>; // rackId -> flow
  valves: Record<string, 'Open' | 'Throttled' | 'Closed'>;
}

export interface ElectricalState {
  gridVoltageV: number;
  substationPowerMw: number;
  mainSwitchgearStatus: OperatingStatus;
  upsStatus: OperatingStatus;
  upsBatteryChargePercent: number;
  facilityTotalPowerKw: number;
  facilityITPowerKw: number;
  coolingElectricalPowerKw: number;
  auxiliaryPowerKw: number;
  instantaneousPUE: number;
  instantaneousWUE: number; // Water usage effectiveness (L/kWh)
}

export interface HeatRecoveryState {
  hxStatus: OperatingStatus;
  hxEffectiveness: number;
  primaryInletTempC: number;
  primaryOutletTempC: number;
  secondaryInletTempC: number;
  secondaryOutletTempC: number;
  heatTransferredKw: number;
  // Secondary Thermal Buffer Tank
  bufferTankTempC: number;
  bufferTankVolumeL: number;
  bufferStoredEnergyMj: number;
  bufferLossesKw: number;
  // Energy Balance
  energyBalanceResidualPercent: number; // Conservation check
  isEnergyConserved: boolean;
}

export interface AgmdState {
  systemStatus: OperatingStatus;
  feedPumpActive: boolean;
  feedFlowKgS: number; // kg/s
  feedInletTempC: number; // °C
  feedSalinityG_Kg: number; // g/kg (35 g/kg baseline)
  membraneHotSideTempC: number; // °C
  membraneColdSideTempC: number; // °C
  vaporPressureDifferentialKPa: number; // kPa
  distillateFluxKgM2H: number; // kg/(m²·h)
  freshwaterProductionRateL_H: number; // L/h
  cumulativeFreshwaterL: number; // Liters
  brineOutletTempC: number;
  brineSalinityG_Kg: number;
  specificThermalEnergyConsumptionKwh_M3: number; // STEC
}

export interface SimulationClock {
  simTimeSeconds: number;
  isRunning: boolean;
  timeStepSeconds: number;
  playbackSpeed: number; // 1x, 2x, 5x
  mode: 'live' | 'experiment';
  experimentDurationSeconds: number;
  isComplete: boolean;
}

export interface IntegratedEngineeringState {
  clock: SimulationClock;
  gpus: Record<string, GpuEntity>;
  servers: Record<string, ServerEntity>;
  racks: Record<string, RackEntity>;
  halls: Record<string, HallEntity>;
  hydraulics: HydraulicState;
  electrical: ElectricalState;
  heatRecovery: HeatRecoveryState;
  agmd: AgmdState;
  selectedWorkloadPreset: string;
}

/**
 * Initializes the full 4-hall, 24-rack, 144-server, 144-GPU physical hierarchy
 */
export function initializeEngineeringState(): IntegratedEngineeringState {
  const gpus: Record<string, GpuEntity> = {};
  const servers: Record<string, ServerEntity> = {};
  const racks: Record<string, RackEntity> = {};
  const halls: Record<string, HallEntity> = {};

  const hallConfigs = [
    {
      id: 'HALL-A',
      code: 'A',
      name: 'Hall A — AI Training',
      subTitle: 'AI Training',
      workloadProfile: 'High-intensity compute',
      profileType: 'ai_training' as const,
      accentColor: '#38bdf8',
      baseUtilization: 0.92,
      center: [-20, 0, -14] as [number, number, number],
    },
    {
      id: 'HALL-B',
      code: 'B',
      name: 'Hall B — AI Inference',
      subTitle: 'AI Inference',
      workloadProfile: 'Variable workload environment',
      profileType: 'ai_inference' as const,
      accentColor: '#34d399',
      baseUtilization: 0.68,
      center: [-20, 0, 14] as [number, number, number],
    },
    {
      id: 'HALL-C',
      code: 'C',
      name: 'Hall C — HPC & Research',
      subTitle: 'HPC & Research',
      workloadProfile: 'Sustained computational workload',
      profileType: 'hpc_research' as const,
      accentColor: '#818cf8',
      baseUtilization: 0.85,
      center: [20, 0, -14] as [number, number, number],
    },
    {
      id: 'HALL-D',
      code: 'D',
      name: 'Hall D — Experimental Hall',
      subTitle: 'Experimental Hall',
      workloadProfile: 'Configurable workload',
      profileType: 'experimental' as const,
      accentColor: '#fbbf24',
      baseUtilization: 0.55,
      center: [20, 0, 14] as [number, number, number],
    },
  ];

  const xOffsets = [-3.2, 0, 3.2];
  const slotPositions = [6, 12, 18, 24, 30, 36];

  for (const hConfig of hallConfigs) {
    const hallRackIds: string[] = [];

    for (let r = 1; r <= 6; r++) {
      const rackNumStr = String(r).padStart(2, '0');
      const rackCode = `${hConfig.code}${rackNumStr}`;
      const rackId = `Rack ${rackCode}`;
      hallRackIds.push(rackId);

      const isRow1 = r <= 3;
      const row = isRow1 ? 1 : 2;
      const colInRow = isRow1 ? r : r - 3;
      const localX = xOffsets[colInRow - 1];
      const localZ = isRow1 ? -2.2 : 2.2;
      const facingZ = isRow1 ? 1 : -1;
      const worldPos: [number, number, number] = [
        hConfig.center[0] + localX,
        0,
        hConfig.center[2] + localZ,
      ];

      const rackServerIds: string[] = [];
      const rackGpuIds: string[] = [];

      for (let g = 0; g < 6; g++) {
        const gpuNum = g + 1;
        const gpuNumStr = String(gpuNum).padStart(2, '0');
        const gpuId = `GPU ${rackCode}-GPU${gpuNumStr}`;
        const srvId = `SRV ${rackCode}-${gpuNumStr}`;

        rackGpuIds.push(gpuId);
        rackServerIds.push(srvId);

        const slotRU = slotPositions[g];
        const initialUtil = hConfig.baseUtilization;
        const initialPowerW =
          ENGINEERING_ASSUMPTIONS.gpu.idlePowerW +
          initialUtil * (ENGINEERING_ASSUMPTIONS.gpu.thermalDesignPowerW - ENGINEERING_ASSUMPTIONS.gpu.idlePowerW);

        gpus[gpuId] = {
          id: gpuId,
          name: gpuId,
          rackId,
          serverId: srvId,
          hallId: hConfig.id,
          indexInRack: g,
          gpuNumber: gpuNum,
          slotRU,
          model: ENGINEERING_ASSUMPTIONS.gpu.model,
          utilization: initialUtil,
          powerW: initialPowerW,
          heatDissipationW: initialPowerW * ENGINEERING_ASSUMPTIONS.gpu.thermalDissipationFraction,
          temperatureC: 45.0, // baseline initial warm temperature
          coldPlateTempC: 38.0,
          thermalLimitC: ENGINEERING_ASSUMPTIONS.gpu.maxOperatingTempC,
          thermalMarginC: ENGINEERING_ASSUMPTIONS.gpu.maxOperatingTempC - 45.0,
          clockMhz: 1800,
          coolantFlowKgS: ENGINEERING_ASSUMPTIONS.hydraulics.minCoolantFlowPerGpuKgS,
          coolantInletTempC: ENGINEERING_ASSUMPTIONS.hydraulics.primarySupplyTempSetpointC,
          coolantOutletTempC: 38.5,
          operatingStatus: 'Normal',
          fault: 'None',
          history: [{ time: 0, tempC: 45.0, powerW: initialPowerW }],
        };

        const serverElecW =
          (initialPowerW +
            ENGINEERING_ASSUMPTIONS.server.cpuPowerW +
            ENGINEERING_ASSUMPTIONS.server.memoryPowerW +
            ENGINEERING_ASSUMPTIONS.server.nicAndPciePowerW) /
          ENGINEERING_ASSUMPTIONS.server.psuEfficiency;

        servers[srvId] = {
          id: srvId,
          rackId,
          hallId: hConfig.id,
          slotRU,
          heightRU: 4,
          gpuId,
          cpuPowerW: ENGINEERING_ASSUMPTIONS.server.cpuPowerW,
          memoryPowerW: ENGINEERING_ASSUMPTIONS.server.memoryPowerW,
          nicPowerW: ENGINEERING_ASSUMPTIONS.server.nicAndPciePowerW,
          totalElectricalPowerW: serverElecW,
          heatLoadW: serverElecW * 0.98,
          psuAFault: false,
          psuBFault: false,
          status: 'Normal',
        };
      }

      const totalRackITPowerW = rackGpuIds.reduce((sum, gId) => sum + gpus[gId].powerW, 0);
      const rackTotalElecW = rackServerIds.reduce((sum, sId) => sum + servers[sId].totalElectricalPowerW, 0);

      racks[rackId] = {
        id: rackId,
        code: rackCode,
        hallId: hConfig.id,
        hallCode: hConfig.code,
        rackNumber: r,
        row,
        colInRow,
        position: worldPos,
        facingZ,
        ruHeight: 42,
        occupiedRU: 24,
        serverIds: rackServerIds,
        gpuIds: rackGpuIds,
        totalITPowerW: totalRackITPowerW,
        pduFeedAKw: (rackTotalElecW / 2) / 1000.0,
        pduFeedBKw: (rackTotalElecW / 2) / 1000.0,
        circuitCurrentAmps: (rackTotalElecW / (415 * 0.95 * Math.sqrt(3))),
        coolantSupplyTempC: 28.0,
        coolantReturnTempC: 39.5,
        coolantFlowKgS: ENGINEERING_ASSUMPTIONS.hydraulics.nominalRackCoolantFlowKgS,
        pressureDropKPa: ENGINEERING_ASSUMPTIONS.hydraulics.manifoldPressureDropKPa,
        averageGpuTempC: 45.0,
        maxGpuTempC: 46.2,
        heatLoadKw: totalRackITPowerW / 1000.0,
        status: 'Normal',
      };
    }

    const hallTotalITPowerKw = hallRackIds.reduce((sum, rId) => sum + racks[rId].totalITPowerW, 0) / 1000.0;

    halls[hConfig.id] = {
      id: hConfig.id,
      code: hConfig.code,
      name: hConfig.name,
      subTitle: hConfig.subTitle,
      workloadProfile: hConfig.workloadProfile,
      profileType: hConfig.profileType,
      accentColor: hConfig.accentColor,
      targetAisleTempC: 22.0,
      rackIds: hallRackIds,
      totalITPowerKw: hallTotalITPowerKw,
      coolantFlowKgS: hallRackIds.length * ENGINEERING_ASSUMPTIONS.hydraulics.nominalRackCoolantFlowKgS,
      coolantSupplyTempC: 28.0,
      coolantReturnTempC: 39.5,
      averageGpuTempC: 45.0,
      maxGpuTempC: 46.5,
      status: 'Normal',
    };
  }

  const facilityITPowerKw = Object.values(halls).reduce((sum, h) => sum + h.totalITPowerKw, 0);
  const pumpFlowKgS = 24 * ENGINEERING_ASSUMPTIONS.hydraulics.nominalRackCoolantFlowKgS; // 1.60 kg/s

  return {
    clock: {
      simTimeSeconds: 0,
      isRunning: true,
      timeStepSeconds: 1.0,
      playbackSpeed: 1,
      mode: 'live',
      experimentDurationSeconds: 120,
      isComplete: false,
    },
    gpus,
    servers,
    racks,
    halls,
    hydraulics: {
      pumpStatus: 'Normal',
      pumpSpeedRpm: ENGINEERING_ASSUMPTIONS.hydraulics.nominalPumpSpeedRpm,
      pumpSpeedFraction: 0.64,
      totalSystemFlowKgS: pumpFlowKgS,
      pumpHeadPressureBar: 3.2,
      primarySupplyTempC: ENGINEERING_ASSUMPTIONS.hydraulics.primarySupplyTempSetpointC,
      primaryReturnTempC: 39.5,
      primaryLoopHeatKw: 76.8,
      hallFlowsKgS: {
        'HALL-A': pumpFlowKgS / 4,
        'HALL-B': pumpFlowKgS / 4,
        'HALL-C': pumpFlowKgS / 4,
        'HALL-D': pumpFlowKgS / 4,
      },
      rackFlowsKgS: Object.fromEntries(
        Object.keys(racks).map((rId) => [rId, ENGINEERING_ASSUMPTIONS.hydraulics.nominalRackCoolantFlowKgS])
      ),
      valves: Object.fromEntries(Object.keys(racks).map((rId) => [rId, 'Open' as const])),
    },
    electrical: {
      gridVoltageV: 11000.0,
      substationPowerMw: (facilityITPowerKw * 1.15) / 1000.0,
      mainSwitchgearStatus: 'Normal',
      upsStatus: 'Normal',
      upsBatteryChargePercent: 100.0,
      facilityTotalPowerKw: facilityITPowerKw * 1.15,
      facilityITPowerKw,
      coolingElectricalPowerKw: facilityITPowerKw * 0.10,
      auxiliaryPowerKw: facilityITPowerKw * 0.03,
      instantaneousPUE: 1.15,
      instantaneousWUE: 0.08,
    },
    heatRecovery: {
      hxStatus: 'Normal',
      hxEffectiveness: ENGINEERING_ASSUMPTIONS.heatExchanger.nominalEffectiveness,
      primaryInletTempC: 39.5,
      primaryOutletTempC: 28.0,
      secondaryInletTempC: 25.0,
      secondaryOutletTempC: 35.2,
      heatTransferredKw: 76.8,
      bufferTankTempC: ENGINEERING_ASSUMPTIONS.thermalBuffer.initialTempC,
      bufferTankVolumeL: ENGINEERING_ASSUMPTIONS.thermalBuffer.capacityLiters,
      bufferStoredEnergyMj: 2380.0,
      bufferLossesKw: 0.65,
      energyBalanceResidualPercent: 0.0,
      isEnergyConserved: true,
    },
    agmd: {
      systemStatus: 'Normal',
      feedPumpActive: true,
      feedFlowKgS: ENGINEERING_ASSUMPTIONS.agmd.nominalFeedFlowKgS,
      feedInletTempC: ENGINEERING_ASSUMPTIONS.thermalBuffer.initialTempC,
      feedSalinityG_Kg: ENGINEERING_ASSUMPTIONS.agmd.feedSalinityG_Kg,
      membraneHotSideTempC: 35.3,
      membraneColdSideTempC: 21.0,
      vaporPressureDifferentialKPa: 3.12,
      distillateFluxKgM2H: 3.60,
      freshwaterProductionRateL_H: 86.4, // 3.60 kg/(m²·h) * 24 m² = 86.4 kg/h ≈ 86.4 L/h
      cumulativeFreshwaterL: 0.0,
      brineOutletTempC: 35.0,
      brineSalinityG_Kg: 35.6,
      specificThermalEnergyConsumptionKwh_M3: 680.0,
    },
    selectedWorkloadPreset: 'AI Training Baseline',
  };
}
